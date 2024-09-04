class TextToSpeechPlayer {
    constructor() {
        this.synth = window.speechSynthesis;
        this.utterance = new SpeechSynthesisUtterance();
        this.utterance.leng = 'zh_CN';
        this.isPlaying = false;
        this.voices = [];
        this.currentVoiceIndex = 0;
        this.volume = 1;
        this.rate = 1;
        this.callback = null;
        this.book = null;
        this.currentChapter = 0;
        this.chapterList = [];

        this.createFloatingButtons();
        this.createSettingsPanel();
        this.loadVoices();
        this.loadSettings();
        this.setupEpubUpload();
        this.setupKeyboardNavigation();

        this.setupUrlInput();
        this.loadUrlHistory();

        this.synth.onvoiceschanged = () => this.loadVoices();
    }

    loadVoices() {
        this.voices = this.synth.getVoices();
        this.updateVoiceList();
    }

    createFloatingButtons() {
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            display: flex;
            gap: 10px;
            z-index: 1000;
        `;

        const playPauseButton = this.createButton('▶️', 'ttsPlayPauseButton', '#007bff');
        playPauseButton.addEventListener('click', () => this.togglePlayPause());

        const stopButton = this.createButton('⏹️', 'ttsStopButton', '#dc3545');
        stopButton.addEventListener('click', () => this.stop());

        const settingsButton = this.createButton('⚙️', 'ttsSettingsButton', '#6c757d');
        settingsButton.addEventListener('click', () => this.toggleSettings());

        buttonContainer.appendChild(playPauseButton);
        buttonContainer.appendChild(stopButton);
        buttonContainer.appendChild(settingsButton);

        document.body.appendChild(buttonContainer);
    }

    createButton(innerHTML, id, bgColor) {
        const button = document.createElement('button');
        button.id = id;
        button.innerHTML = innerHTML;
        button.style.cssText = `
            width: 50px;
            height: 50px;
            border-radius: 25px;
            background-color: ${bgColor};
            color: white;
            border: none;
            font-size: 24px;
            cursor: pointer;
        `;
        return button;
    }

    createSettingsPanel() {
        const panel = document.createElement('div');
        panel.id = 'ttsSettings';
        panel.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 20px;
            width: 200px;
            background-color: white;
            border: 1px solid #ccc;
            padding: 10px;
            display: none;
            z-index: 1000;
        `;

        panel.innerHTML = `
            <select id="ttsVoice"></select>
            <input type="range" id="ttsVolume" min="0" max="1" step="0.1" value="1">
            <select id="ttsRate">
                <option value="0.5">0.5x</option>
                <option value="1" selected>1x</option>
                <option value="1.5">1.5x</option>
                <option value="2">2x</option>
            </select>
        `;

        document.body.appendChild(panel);

        document.getElementById('ttsVoice').addEventListener('change', (e) => {
            this.currentVoiceIndex = e.target.selectedIndex;
            this.updateVoice();
            this.saveSettings();
        });

        document.getElementById('ttsVolume').addEventListener('input', (e) => {
            this.volume = parseFloat(e.target.value);
            this.updateVolume();
            this.saveSettings();
        });

        document.getElementById('ttsRate').addEventListener('change', (e) => {
            this.rate = parseFloat(e.target.value);
            this.updateRate();
            this.saveSettings();
        });
    }

    updateVoiceList() {
        const voiceSelect = document.getElementById('ttsVoice');
        voiceSelect.innerHTML = '';
        this.voices.forEach((voice, index) => {
            const option = document.createElement('option');
            option.textContent = `${voice.name} (${voice.lang})`;
            option.setAttribute('data-lang', voice.lang);
            option.setAttribute('data-name', voice.name);
            voiceSelect.appendChild(option);
        });
        voiceSelect.selectedIndex = this.currentVoiceIndex;
    }

    updateVoice() {
        this.utterance.voice = this.voices[this.currentVoiceIndex];
    }

    updateVolume() {
        this.utterance.volume = this.volume;
    }

    updateRate() {
        this.utterance.rate = this.rate;
    }

    togglePlayPause() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    setupEpubUpload() {
        const fileInput = document.getElementById('epub-upload');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        } else {
            console.error('File input element not found');
        }
    }

    setupUrlInput() {
        const urlInput = document.getElementById('epub-url');
        const loadUrlButton = document.getElementById('load-url');
        const toggleHistoryButton = document.getElementById('toggle-history');
        const urlHistory = document.getElementById('url-history');
    
        loadUrlButton.addEventListener('click', () => this.loadEpubFromUrl(urlInput.value));
        toggleHistoryButton.addEventListener('click', () => {
            urlHistory.style.display = urlHistory.style.display === 'none' ? 'block' : 'none';
        });
        urlHistory.addEventListener('change', (e) => {
            urlInput.value = e.target.value;
        });
    }
    
    loadEpubFromUrl(url) {
        fetch(url)
            .then(response => response.arrayBuffer())
            .then(arrayBuffer => {
                this.loadEpub(arrayBuffer, url);
                this.addToUrlHistory(url);
            })
            .catch(error => console.error('Error loading EPUB from URL:', error));
    }
    
    addToUrlHistory(url) {
        let history = JSON.parse(localStorage.getItem('epubUrlHistory') || '[]');
        if (!history.includes(url)) {
            history.push(url);
            localStorage.setItem('epubUrlHistory', JSON.stringify(history));
            this.updateUrlHistoryDropdown();
        }
    }
    
    loadUrlHistory() {
        const history = JSON.parse(localStorage.getItem('epubUrlHistory') || '[]');
        this.updateUrlHistoryDropdown(history);
    }
    
    updateUrlHistoryDropdown(history) {
        const urlHistory = document.getElementById('url-history');
        urlHistory.innerHTML = '<option value="">Select from history</option>';
        history.forEach(url => {
            const option = document.createElement('option');
            option.value = url;
            option.textContent = url;
            urlHistory.appendChild(option);
        });
        urlHistory.selectedIndex = 0; // 确保默认选中第一个选项（空选项）
    }

    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                // this.previousChapter();
                this.flipPage(false);
            } else if (e.key === 'ArrowRight') {
                // this.nextChapter();
                this.flipPage(true);
            } else if (e.key === ' ' || e.key === 'Spacebar') {
                e.preventDefault(); // Prevent default space bar behavior (usually scrolling)
                this.flipPage(true);
            }
        });
    }

    flipPage(next) {
        if (this.rendition) {
            if(next){
                this.rendition.next();
            }else{
                this.rendition.prev();
            }
        }
    }

    handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) {
            console.error('No file selected');
            return;
        }
        if (file.type !== 'application/epub+zip') {
            alert('Please upload an EPUB file.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const arrayBuffer = e.target.result;
            this.loadEpub(arrayBuffer);
        };
        reader.onerror = (error) => {
            console.error('Error reading file:', error);
        };
        reader.readAsArrayBuffer(file);
    }

    saveReadingProgress() {
        if (this.book && this.rendition) {
            const currentLocation = this.rendition.currentLocation();
            const progress = {
                bookUrl: this.bookurl,
                location: currentLocation.start.cfi,
                timestamp: new Date().getTime()
            };
            localStorage.setItem('epubReadingProgress', JSON.stringify(progress));
        }
    }
    
    loadReadingProgress() {
        const savedProgress = localStorage.getItem('epubReadingProgress');
        if (savedProgress) {
            const progress = JSON.parse(savedProgress);
            if (progress.bookUrl === this.bookurl) {
                this.rendition.display(progress.location);
            }
        }
    }
    
    loadEpub(arrayBuffer, url = '') {
        try {
            console.log('Starting to load EPUB...');
                this.book = ePub(arrayBuffer);
                this.bookurl = url;  // Save the URL for later reference
            
            console.log('EPUB object created:', this.book);
            
            if (!this.book.loaded || !this.book.loaded.navigation) {
                console.error('Book loaded property or navigation is undefined');
                return;
            }
    
            console.log('Waiting for navigation to load...');
            this.book.loaded.navigation.then(() => {
                console.log('Navigation loaded successfully');
                this.currentChapter = 0;
                this.loadChapterList();
                
                this.rendition = this.book.renderTo("epub-content", {
                    width: "100%",
                    height: "100%",
                    spread: "always"
                });
    
                this.loadReadingProgress();  // Load the previous reading progress
                this.displayChapter();
    
                // Save progress when the page changes
                this.rendition.on('relocated', () => {
                    this.saveReadingProgress();
                });
            }).catch(error => {
                console.error('Error loading EPUB navigation:', error);
            });
        } catch (error) {
            console.error('Error in loadEpub:', error);
        }
    }

    loadChapterList() {
        this.chapterList = this.book.navigation.toc;
        const tocElement = document.getElementById('toc');
        if (tocElement) {
            tocElement.innerHTML = '<h2>Table of Contents</h2>';
            const ul = document.createElement('ul');
            this.chapterList.forEach((chapter, index) => {
                const li = document.createElement('li');
                const a = document.createElement('a');
                a.textContent = chapter.label;
                a.href = '#';
                a.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.currentChapter = index;
                    this.displayChapter();
                });
                li.appendChild(a);
                ul.appendChild(li);
            });
            tocElement.appendChild(ul);
        }
    }

    displayChapter() {
        if (!this.book || !this.rendition) {
            console.error('No book loaded or rendition not created');
            return;
        }
    
        const chapter = this.chapterList[this.currentChapter];
        if (!chapter) {
            console.log('End of book reached');
            return;
        }
    
        this.rendition.display(chapter.href).then(() => {
            // The content is now displayed in the 'epub-content' element
            console.log(`Displaying chapter: ${chapter.label}`);
        }).catch(error => {
            console.error('Error loading chapter:', error);
        });
    }

    previousChapter() {
        if (this.currentChapter > 0) {
            this.currentChapter--;
            this.displayChapter();
        }
    }

    nextChapter() {
        if (this.currentChapter < this.chapterList.length - 1) {
            this.currentChapter++;
            this.displayChapter();
        }
    }

    play() {
        if (!this.isPlaying) {
            this.isPlaying = true;
            const playPauseButton = document.getElementById('ttsPlayPauseButton');
            if (playPauseButton) {
                playPauseButton.innerHTML = '⏸️';
            }
            
            const playNextPage = () => {
                this.getCurrentPageText().then(text => {
                    if (!text) {
                        console.error('No text content found');
                        return;
                    }
                    this.utterance.text = text;
                    this.updateVoice();
                    this.updateVolume();
                    this.updateRate();
                    this.utterance.onend = () => {
                        this.flipPage(true);
                        playNextPage();
                    };
                    this.synth.speak(this.utterance);
                }).catch(error => {
                    console.error('Error getting page text:', error);
                });
            };
    
            if (this.synth.paused) {
                this.synth.resume();
            } else {
                playNextPage();
            }
        }
    }

    getCurrentChapterText() {
        return new Promise((resolve, reject) => {
            if (!this.book || !this.rendition) {
                reject('No book loaded or rendition not created');
                return;
            }
    
            const chapter = this.chapterList[this.currentChapter];
            if (!chapter) {
                reject('No chapter found');
                return;
            }
    
            this.rendition.display(chapter.href).then(() => {
                const iframe = document.querySelector('#epub-content iframe');
                if (!iframe) {
                    reject('Cannot find iframe element');
                    return;
                }
                const doc = iframe.contentDocument;
                if (!doc) {
                    reject('Cannot access iframe content');
                    return;
                }
                const textContent = doc.body.textContent || doc.body.innerText;
                resolve(textContent.trim());
            }).catch(error => {
                reject(`Error displaying chapter: ${error}`);
            });
        });
    }

    getCurrentPageText() {
        return new Promise((resolve, reject) => {
            if (!this.book || !this.rendition) {
                reject('No book loaded or rendition not created');
                return;
            }
    
            resolve(this.rendition.getContents()[0].content.innerText);
        });
    }

    pause() {
        if (this.isPlaying) {
            this.isPlaying = false;
            document.getElementById('ttsPlayPauseButton').innerHTML = '▶️';
            this.synth.pause();
        }
    }

    stop() {
        this.synth.cancel();
        this.isPlaying = false;
        const playPauseButton = document.getElementById('ttsPlayPauseButton');
        if (playPauseButton) {
            playPauseButton.innerHTML = '▶️';
        }
        // Reset to the beginning of the current chapter
        this.displayChapter();
    }

    toggleSettings() {
        const panel = document.getElementById('ttsSettings');
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }

    setCallback(callback) {
        this.callback = callback;
    }

    saveSettings() {
        const settings = {
            currentVoiceIndex: this.currentVoiceIndex,
            volume: this.volume,
            rate: this.rate
        };
        localStorage.setItem('ttsSettings', JSON.stringify(settings));
    }

    loadSettings() {
        const savedSettings = localStorage.getItem('ttsSettings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            this.currentVoiceIndex = settings.currentVoiceIndex || 0;
            this.volume = settings.volume || 1;
            this.rate = settings.rate || 1;

            document.getElementById('ttsVoice').selectedIndex = this.currentVoiceIndex;
            document.getElementById('ttsVolume').value = this.volume;
            document.getElementById('ttsRate').value = this.rate;

            this.updateVoice();
            this.updateVolume();
            this.updateRate();
        }
    }
}

// Initialize the TextToSpeechPlayer when the page loads
window.addEventListener('DOMContentLoaded', () => {
    window.ttsPlayer = new TextToSpeechPlayer();
});