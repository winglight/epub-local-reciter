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
        
        // 初始化R2同步
        this.initR2Sync();

        // 创建左上角R2设置按钮
        this.createTopLeftR2Button();
        
        this.createFloatingButtons();

        this.createSettingsPanel();

        
        this.loadSettings();
        this.setupEpubUpload();
        this.setupKeyboardNavigation();

        this.setupUrlInput();
        this.loadUrlHistory();
        
        // 自动加载上次打开的EPUB文件
        this.autoLoadLastEpub();

        this.synth.onvoiceschanged = () => this.loadVoices();
        this.loadVoices();

        // 定期同步数据
        this.setupPeriodicSync();
    }
    
    // 初始化R2同步
    initR2Sync() {
        try {
            // 检查R2Sync类是否可用
            if (typeof R2Sync === 'function') {
                // 直接实例化
                this.r2sync = new R2Sync();
                
                // 初始同步
                this.syncWithR2();
            } else {
                console.warn('R2Sync class not available');
            }
        } catch (error) {
            console.error('Error initializing R2Sync:', error);
        }
    }
    
    loadVoices() {
        // 获取语音列表
        const availableVoices = this.synth.getVoices();
        
        // 检查是否获取到了语音
        if (availableVoices && availableVoices.length > 0) {
            // 筛选指定语言的声音
            // 这里筛选中文声音，包括 zh-CN, zh-TW, zh-HK 等
            const preferredLanguages = ['zh', 'zh-CN', 'zh-TW', 'zh-HK'];
            
            // 先尝试精确匹配指定语言
            let filteredVoices = availableVoices.filter(voice => 
                preferredLanguages.includes(voice.lang)
            );
            
            // 如果没有精确匹配的语言，尝试部分匹配（以zh开头的语言）
            if (filteredVoices.length === 0) {
                filteredVoices = availableVoices.filter(voice => 
                    voice.lang.startsWith('zh')
                );
            }
            
            // 如果仍然没有匹配的语言，使用所有可用的声音
            this.voices = filteredVoices.length > 0 ? filteredVoices : availableVoices;
            
            console.log(`加载了 ${this.voices.length} 个语音，其中中文语音 ${filteredVoices.length} 个`);
            this.updateVoiceList();
        } else {
            console.warn('未能获取到语音列表，将在语音引擎准备好后重试');
            
            // 如果没有获取到语音，设置一个延迟重试
            setTimeout(() => {
                const retryVoices = this.synth.getVoices();
                if (retryVoices && retryVoices.length > 0) {
                    // 同样筛选指定语言
                    const preferredLanguages = ['zh', 'zh-CN', 'zh-TW', 'zh-HK'];
                    let filteredVoices = retryVoices.filter(voice => 
                        preferredLanguages.includes(voice.lang)
                    );
                    
                    if (filteredVoices.length === 0) {
                        filteredVoices = retryVoices.filter(voice => 
                            voice.lang.startsWith('zh')
                        );
                    }
                    
                    this.voices = filteredVoices.length > 0 ? filteredVoices : retryVoices;
                    console.log(`延迟加载了 ${this.voices.length} 个语音，其中中文语音 ${filteredVoices.length} 个`);
                    this.updateVoiceList();
                }
            }, 1000); // 延迟1秒重试
        }
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

    // 创建左上角R2设置按钮
    createTopLeftR2Button() {
        // 创建按钮容器
        const topLeftContainer = document.createElement('div');
        topLeftContainer.style.position = 'fixed';
        topLeftContainer.style.bottom = '20px';
        topLeftContainer.style.left = '20px';
        topLeftContainer.style.zIndex = '1000';
        document.body.appendChild(topLeftContainer);
        
        // 创建R2设置按钮
        const r2SettingsButton = document.createElement('button');
        r2SettingsButton.textContent = 'R2设置';
        r2SettingsButton.style.backgroundColor = '#17a2b8';
        r2SettingsButton.style.color = 'white';
        r2SettingsButton.style.border = 'none';
        r2SettingsButton.style.borderRadius = '4px';
        r2SettingsButton.style.padding = '8px 12px';
        r2SettingsButton.style.cursor = 'pointer';
        r2SettingsButton.style.fontWeight = 'bold';
        r2SettingsButton.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
        
        // 添加悬停效果
        r2SettingsButton.addEventListener('mouseover', () => {
            r2SettingsButton.style.backgroundColor = '#138496';
        });
        r2SettingsButton.addEventListener('mouseout', () => {
            r2SettingsButton.style.backgroundColor = '#17a2b8';
        });
        
        // 添加点击事件
        r2SettingsButton.addEventListener('click', () => this.openR2ConfigDialog());
        
        // 将按钮添加到容器
        topLeftContainer.appendChild(r2SettingsButton);
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
    
    // 打开R2配置对话框
    openR2ConfigDialog() {
        if (this.r2sync) {
            this.r2sync.createConfigDialog(() => {
                // 配置保存后执行同步
                this.syncWithR2();
            });
        }
    }
    
    // 设置定期同步
    setupPeriodicSync() {
        // 每5分钟同步一次
        setInterval(() => {
            this.syncWithR2();
        }, 5 * 60 * 1000);
    }
    
    // 与R2同步数据
    async syncWithR2() {
        if (!this.r2sync || !this.r2sync.config.enabled) return;
        
        try {
            // 同步设置
            await this.syncSettings();
            
            // 同步阅读进度
            await this.syncReadingProgress();
            
            // 同步EPUB文件缓存
            await this.syncEpubCache();
            
            // 同步URL历史
            await this.syncUrlHistory();
            
            console.log('Data synchronized with R2');
        } catch (error) {
            console.error('Error syncing with R2:', error);
        }
    }
    
    // 同步设置
    async syncSettings() {
        if (!this.r2sync) return;
        
        // 获取本地设置
        const localSettings = JSON.parse(localStorage.getItem('ttsSettings') || '{}');
        localSettings.timestamp = new Date().getTime();
        
        // 同步到R2
        await this.r2sync.syncToR2(localSettings, 'ttsSettings');
        
        // 从R2获取设置
        const remoteSettings = await this.r2sync.loadFromR2('ttsSettings');
        
        // 如果远程设置存在且比本地新，则更新本地设置
        if (remoteSettings && remoteSettings.timestamp > (localSettings.timestamp || 0)) {
            localStorage.setItem('ttsSettings', JSON.stringify(remoteSettings));
            
            // 重新加载设置
            this.loadSettings();
        }
    }
    
    // 同步阅读进度
    async syncReadingProgress() {
        if (!this.r2sync) return;
        
        // 获取本地阅读进度
        const localProgress = JSON.parse(localStorage.getItem('epubReadingProgress') || '{}');
        localProgress.timestamp = localProgress.timestamp || new Date().getTime();
        
        // 同步到R2
        await this.r2sync.syncToR2(localProgress, 'epubReadingProgress');
        
        // 从R2获取阅读进度
        const remoteProgress = await this.r2sync.loadFromR2('epubReadingProgress');
        
        // 如果远程进度存在且比本地新，则更新本地进度
        if (remoteProgress && remoteProgress.timestamp > (localProgress.timestamp || 0)) {
            localStorage.setItem('epubReadingProgress', JSON.stringify(remoteProgress));
            
            // 如果当前加载的书籍与远程进度相同，则更新阅读位置
            if (this.bookurl === remoteProgress.bookUrl && this.rendition) {
                this.rendition.display(remoteProgress.location);
            }
        }
    }
    
    // 同步EPUB文件缓存
    async syncEpubCache() {
        if (!this.r2sync) return;
        
        // 获取本地缓存
        const localCache = {
            files: JSON.parse(localStorage.getItem('epubCachedFiles') || '[]'),
            timestamp: new Date().getTime()
        };
        
        // 同步到R2
        await this.r2sync.syncToR2(localCache, 'epubCachedFiles');
        
        // 从R2获取缓存
        const remoteCache = await this.r2sync.loadFromR2('epubCachedFiles');
        
        // 如果远程缓存存在且比本地新，则更新本地缓存
        if (remoteCache && remoteCache.timestamp > (localCache.timestamp || 0) && remoteCache.files) {
            localStorage.setItem('epubCachedFiles', JSON.stringify(remoteCache.files));
            
            // 更新缓存文件下拉框
            this.updateCachedFilesDropdown();
        }
    }
    
    // 同步URL历史
    async syncUrlHistory() {
        if (!this.r2sync) return;
        
        // 获取本地URL历史
        const localHistory = {
            urls: JSON.parse(localStorage.getItem('epubUrlHistory') || '[]'),
            timestamp: new Date().getTime()
        };
        
        // 同步到R2
        await this.r2sync.syncToR2(localHistory, 'epubUrlHistory');
        
        // 从R2获取URL历史
        const remoteHistory = await this.r2sync.loadFromR2('epubUrlHistory');
        
        // 如果远程历史存在且比本地新，则更新本地历史
        if (remoteHistory && remoteHistory.timestamp > (localHistory.timestamp || 0) && remoteHistory.urls) {
            localStorage.setItem('epubUrlHistory', JSON.stringify(remoteHistory.urls));
            
            // 更新URL历史下拉框
            this.updateUrlHistoryDropdown(remoteHistory.urls);
        }
    }
    
    // 自动加载上次打开的EPUB文件
    autoLoadLastEpub() {
        const lastOpenedEpub = localStorage.getItem('lastOpenedEpub');
        if (lastOpenedEpub) {
            // 尝试从缓存加载
            const loaded = this.loadCachedEpub(lastOpenedEpub);
            
            // 如果是URL，则从URL加载
            if (!loaded && lastOpenedEpub.startsWith('http')) {
                this.loadEpubFromUrl(lastOpenedEpub);
            }
        }
    }
    
    // 保存阅读进度时同步到R2
    saveReadingProgress() {
        if (this.book && this.rendition) {
            const currentLocation = this.rendition.currentLocation();
            const progress = {
                bookUrl: this.bookurl,
                location: currentLocation.start.cfi,
                timestamp: new Date().getTime()
            };
            localStorage.setItem('epubReadingProgress', JSON.stringify(progress));
            
            // 同步到R2
            if (this.r2sync && this.r2sync.config.enabled) {
                this.r2sync.syncToR2(progress, 'epubReadingProgress').catch(error => {
                    console.error('Error syncing reading progress:', error);
                });
            }
        }
    }
    
    // 保存设置时同步到R2
    saveSettings() {
        const settings = {
            currentVoiceIndex: this.currentVoiceIndex,
            volume: this.volume,
            rate: this.rate,
            timestamp: new Date().getTime()
        };
        localStorage.setItem('ttsSettings', JSON.stringify(settings));
        
        // 同步到R2
        if (this.r2sync && this.r2sync.config.enabled) {
            this.r2sync.syncToR2(settings, 'ttsSettings').catch(error => {
                console.error('Error syncing settings:', error);
            });
        }
    }
    
    // 缓存EPUB文件时同步到R2
    cacheEpubFile(filename, arrayBuffer) {
        try {
            // 将ArrayBuffer转换为Base64字符串
            const base64 = this.arrayBufferToBase64(arrayBuffer);
            
            // 创建缓存对象
            const epubCache = {
                name: filename,
                data: base64,
                timestamp: new Date().getTime()
            };
            
            // 获取现有的缓存列表
            let cachedFiles = JSON.parse(localStorage.getItem('epubCachedFiles') || '[]');
            
            // 检查是否已存在同名文件，如果存在则更新
            const existingIndex = cachedFiles.findIndex(item => item.name === filename);
            if (existingIndex !== -1) {
                cachedFiles[existingIndex] = epubCache;
            } else {
                // 添加到缓存列表
                cachedFiles.push(epubCache);
            }
            
            // 限制缓存数量，最多保存5个文件
            if (cachedFiles.length > 5) {
                cachedFiles = cachedFiles.slice(-5);
            }
            
            // 保存到localStorage
            localStorage.setItem('epubCachedFiles', JSON.stringify(cachedFiles));
            
            // 更新最后打开的文件记录
            localStorage.setItem('lastOpenedEpub', filename);
            
            // 更新历史下拉框
            this.updateCachedFilesDropdown();
        } catch (error) {
            console.error('Error caching EPUB file:', error);
        }
    }

    // ArrayBuffer转Base64
    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    // Base64转ArrayBuffer
    base64ToArrayBuffer(base64) {
        const binary_string = window.atob(base64);
        const len = binary_string.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary_string.charCodeAt(i);
        }
        return bytes.buffer;
    }

    // 更新缓存文件下拉框
    updateCachedFilesDropdown() {
        const cachedFiles = JSON.parse(localStorage.getItem('epubCachedFiles') || '[]');
        const urlHistory = document.getElementById('url-history');
        
        // 保留原有的URL历史记录选项
        const urlOptions = Array.from(urlHistory.querySelectorAll('option[value^="http"]'));
        
        // 清空下拉框
        urlHistory.innerHTML = '<option value="">Select from history</option>';
        
        // 添加缓存的文件
        cachedFiles.forEach(file => {
            const option = document.createElement('option');
            option.value = `cached:${file.name}`;
            option.textContent = `📚 ${file.name}`;
            option.dataset.cached = 'true';
            urlHistory.appendChild(option);
        });
        
        // 重新添加URL历史记录
        urlOptions.forEach(option => {
            urlHistory.appendChild(option);
        });
    }

    // 加载缓存的EPUB文件
    loadCachedEpub(filename) {
        try {
            const cachedFiles = JSON.parse(localStorage.getItem('epubCachedFiles') || '[]');
            const cachedFile = cachedFiles.find(file => file.name === filename);
            
            if (cachedFile) {
                const arrayBuffer = this.base64ToArrayBuffer(cachedFile.data);
                this.loadEpub(arrayBuffer, filename);
                
                // 更新最后打开的文件记录
                localStorage.setItem('lastOpenedEpub', filename);
                
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error loading cached EPUB:', error);
            return false;
        }
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
                
                // 修改 rendition 配置，添加 script 允许选项
                this.rendition = this.book.renderTo("epub-content", {
                    width: "100%",
                    height: "100%",
                    spread: "always",
                    allowScriptedContent: true,  // 允许脚本内容执行
                    allowPopups: true  // 允许弹窗
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
            
            // 确保语音合成引擎处于活跃状态
            if (this.synth.speaking) {
                console.log('语音合成引擎正在播放，先取消当前播放');
                this.synth.cancel();
            }
            
            // 强制重新初始化语音合成引擎
            if (window.speechSynthesis !== this.synth) {
                console.log('重新初始化语音合成引擎');
                this.synth = window.speechSynthesis;
            }
            
            const playNextPage = () => {
                this.getCurrentPageText().then(text => {
                    if (!text) {
                        console.error('No text content found');
                        return;
                    }
                    
                    // 分割长文本，避免超出语音合成引擎的限制
                    const maxLength = 200; // 每段最大字符数
                    const textChunks = [];
                    
                    // 按句子分割文本
                    const sentences = text.split(/(?<=[.!?。！？])\s+/);
                    let currentChunk = '';
                    
                    for (const sentence of sentences) {
                        if (currentChunk.length + sentence.length > maxLength) {
                            textChunks.push(currentChunk);
                            currentChunk = sentence;
                        } else {
                            currentChunk += (currentChunk ? ' ' : '') + sentence;
                        }
                    }
                    
                    if (currentChunk) {
                        textChunks.push(currentChunk);
                    }
                    
                    console.log(`准备播放文本 (分为 ${textChunks.length} 段):`, text.substring(0, 50) + '...');
                    
                    // 播放第一段，其余段落在前一段结束后播放
                    const speakChunk = (index) => {
                        if (index >= textChunks.length) {
                            // 所有段落播放完毕，翻页并继续
                            console.log('当前页面播放完毕，准备翻页');
                            this.flipPage(true);
                            playNextPage();
                            return;
                        }
                        
                        // 创建新的 utterance 对象
                        const utterance = new SpeechSynthesisUtterance(textChunks[index]);
                        
                        // 设置语音参数
                        if (this.voices.length > 0 && this.currentVoiceIndex < this.voices.length) {
                            utterance.voice = this.voices[this.currentVoiceIndex];
                            console.log(`使用语音(段落${index+1}/${textChunks.length}):`, utterance.voice ? utterance.voice.name : '默认语音');
                        } else {
                            console.warn('没有可用的语音或语音索引无效');
                        }
                        
                        // 确保语言设置正确
                        if (utterance.voice && utterance.voice.lang) {
                            utterance.lang = utterance.voice.lang;
                        } else {
                            // 默认使用中文
                            utterance.lang = 'zh-CN';
                        }
                        
                        utterance.volume = this.volume;
                        utterance.rate = this.rate;
                        utterance.pitch = 1.0; // 添加默认音调
                        
                        // 添加事件监听器
                        utterance.onstart = () => console.log(`段落 ${index+1}/${textChunks.length} 开始播放`);
                        utterance.onerror = (e) => {
                            console.error(`段落 ${index+1}/${textChunks.length} 播放错误:`, e);
                            // 尝试继续播放下一段
                            speakChunk(index + 1);
                        };
                        utterance.onend = () => {
                            console.log(`段落 ${index+1}/${textChunks.length} 播放结束`);
                            // 播放下一段
                            speakChunk(index + 1);
                        };
                        
                        // 使用用户交互触发语音播放
                        try {
                            // 先清除之前的语音
                            this.synth.cancel();
                            
                            // 确保语音合成引擎处于活跃状态
                            if (!this.synth.speaking && !this.synth.pending) {
                                console.log(`播放段落 ${index+1}/${textChunks.length}`);
                                this.synth.speak(utterance);
                                
                                // 检查是否真的开始播放
                                setTimeout(() => {
                                    if (!this.synth.speaking && !this.synth.pending) {
                                        console.warn('语音合成引擎没有开始播放，尝试使用替代方法');
                                        
                                        // 尝试使用 window 对象上的语音合成
                                        window.speechSynthesis.cancel();
                                        window.speechSynthesis.speak(utterance);
                                        
                                        // 如果仍然没有播放，尝试下一段
                                        setTimeout(() => {
                                            if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
                                                console.warn('替代方法也失败，尝试下一段');
                                                speakChunk(index + 1);
                                            }
                                        }, 500);
                                    }
                                }, 500);
                            }
                        } catch (error) {
                            console.error(`段落 ${index+1} 播放异常:`, error);
                            // 尝试继续播放下一段
                            speakChunk(index + 1);
                        }
                    };
                    
                    // 开始播放第一段
                    speakChunk(0);
                    
                }).catch(error => {
                    console.error('获取页面文本时出错:', error);
                    // 尝试恢复播放状态
                    this.isPlaying = false;
                    if (playPauseButton) {
                        playPauseButton.innerHTML = '▶️';
                    }
                });
            };
    
            if (this.synth.paused) {
                console.log('恢复暂停的语音播放');
                this.synth.resume();
            } else {
                console.log('开始新的语音播放');
                // 确保在用户交互的上下文中触发播放
                setTimeout(() => {
                    playNextPage();
                }, 100);
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
            
            try {
                // 使用 rendition 的 API 获取当前内容
                const contents = this.rendition.getContents();
                if (contents && contents.length > 0) {
                    // 尝试安全地获取文本内容
                    const content = contents[0];
                    if (content && content.document && content.document.body) {
                        const text = content.document.body.innerText || content.document.body.textContent;
                        resolve(text.trim());
                    } else {
                        // 备用方法：使用 iframe 的 contentDocument
                        const iframe = document.querySelector('#epub-content iframe');
                        if (iframe && iframe.contentDocument && iframe.contentDocument.body) {
                            const text = iframe.contentDocument.body.innerText || iframe.contentDocument.body.textContent;
                            resolve(text.trim());
                        } else {
                            reject('无法访问内容文档');
                        }
                    }
                } else {
                    reject('无法获取当前内容');
                }
            } catch (error) {
                console.error('获取页面文本时出错:', error);
                reject(`获取页面文本时出错: ${error.message}`);
            }
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