import * as tf from '@tensorflow/tfjs';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';

class MicroEmotionDetector {
  constructor() {
    this.video = document.getElementById('webcam');
    this.canvas = document.getElementById('overlay');
    this.ctx = this.canvas.getContext('2d');
    this.loadingScreen = document.getElementById('loading-screen');

    this.detector = null;
    this.isModelLoaded = false;
    this.isCalibrating = false;
    this.neutralBaseline = null; // 用于存储平静时的面部特征数据

    // 跟踪数据
    this.historyContainer = document.getElementById('detection-history');
    this.mainResultEl = document.getElementById('detection-result');
    this.confBar = document.getElementById('result-confidence-bar');

    this.lastDetectedEmotion = '';
    this.lastLoggedTime = 0;

    // 实时特征值
    this.metrics = {
      smile: 0,
      browLift: 0,
      eyeOpen: 0,
      mouthOpen: 0,
      squint: 0
    };

    this.init();
    this.addCalibrationBtn();
  }

  addCalibrationBtn() {
    const btn = document.createElement('button');
    btn.id = 'calibrate-btn';
    btn.innerHTML = '🎯 校准平静状态';
    btn.style.cssText = 'position:fixed; bottom:30px; left:50%; transform:translateX(-50%); padding:12px 24px; background:var(--accent-color); color:black; border:none; border-radius:30px; font-weight:bold; cursor:pointer; z-index:100; box-shadow: 0 0 20px var(--accent-glow);';
    btn.onclick = () => this.startCalibration();
    document.body.appendChild(btn);
  }

  startCalibration() {
    this.isCalibrating = true;
    const btn = document.getElementById('calibrate-btn');
    btn.innerHTML = '正在分析您的面部基准...';
    btn.style.background = '#bc13fe';

    // 3秒后完成校准
    setTimeout(() => {
      this.isCalibrating = false;
      this.isCalibrated = true;
      btn.innerHTML = '校准完成 ✅';
      btn.style.background = '#10b981';
      setTimeout(() => btn.innerHTML = '🎯 重新校准', 3000);
    }, 3000);
  }

  async init() {
    try {
      if (!window.isSecureContext && window.location.hostname !== 'localhost') {
        throw new Error('需要 HTTPS 环境以调用摄像头');
      }

      await this.setupCamera();
      await this.loadModels();

      this.animate();

      this.loadingScreen.classList.add('hidden');
      setTimeout(() => this.loadingScreen.style.display = 'none', 500);

    } catch (error) {
      console.error('Init Error:', error);
      this.showError(error.message);
    }
  }

  async setupCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: 640, height: 480 },
      audio: false
    });
    this.video.srcObject = stream;
    return new Promise(r => this.video.onloadedmetadata = r);
  }

  async loadModels() {
    // 使用 'mediapipe' runtime 通常比 'tfjs' 更稳定，因为它会自动处理模型加载
    const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
    const detectorConfig = {
      runtime: 'mediapipe',
      refineLandmarks: true,
      maxFaces: 1,
      solutionPath: `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh`
    };
    this.detector = await faceLandmarksDetection.createDetector(model, detectorConfig);
    this.isModelLoaded = true;
    console.log('Face Mesh 478 (MediaPipe Runtime) loaded');
  }

  animate() {
    if (this.video.readyState === 4) {
      this.processFrame();
    }
    requestAnimationFrame(() => this.animate());
  }

  async processFrame() {
    const faces = await this.detector.estimateFaces(this.video);

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (faces.length > 0) {
      const face = faces[0];
      this.drawLandmarks(face.keypoints);
      this.analyzeGeometry(face.keypoints);
    }
  }

  drawLandmarks(keypoints) {
    this.ctx.fillStyle = '#00f2ff';
    keypoints.forEach((pt, i) => {
      // 隔几个点点一下，避免画面太乱，或者全画出来追求科技感
      if (i % 2 === 0) {
        this.ctx.beginPath();
        this.ctx.arc(pt.x, pt.y, 1, 0, 2 * Math.PI);
        this.ctx.fill();
      }
    });

    // 画出瞳孔（精细点）
    this.ctx.fillStyle = '#bc13fe';
    for (let i = 468; i < 478; i++) {
      if (keypoints[i]) {
        this.ctx.beginPath();
        this.ctx.arc(keypoints[i].x, keypoints[i].y, 2, 0, 2 * Math.PI);
        this.ctx.fill();
      }
    }
  }

  analyzeGeometry(pts) {
    const dist = (p1, p2) => Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);

    // 获取当前核心点位数据
    const currentData = {
      mouthWidth: dist(pts[61], pts[291]),
      noseWidth: dist(pts[102], pts[331]),
      leftBrowDist: dist(pts[107], pts[133]),
      rightBrowDist: dist(pts[336], pts[362]),
      mouthHeight: dist(pts[13], pts[14]),
      leftEyeH: dist(pts[159], pts[145]),
      rightEyeH: dist(pts[386], pts[374])
    };

    // --- 校准逻辑 ---
    if (this.isCalibrating) {
      if (!this.neutralBaseline) {
        this.neutralBaseline = { ...currentData };
      } else {
        // 增量平滑基准值，获取更稳定的平静面相
        for (let key in currentData) {
          this.neutralBaseline[key] = this.neutralBaseline[key] * 0.9 + currentData[key] * 0.1;
        }
      }
      return;
    }

    // 如果还没有基准，直接返回平静
    if (!this.neutralBaseline) {
      this.metrics = { smile: 0, browLift: 0, eyeOpen: 0, mouthOpen: 0, squint: 0 };
      this.determineEmotion();
      return;
    }

    const nb = this.neutralBaseline;

    // --- 基于个人基准的微表情计算 (Deltas) ---

    // 1. 笑容系数：嘴角拉伸相对于平静时的比例
    const mouthStretch = (currentData.mouthWidth / nb.mouthWidth) - 1;
    this.metrics.smile = Math.max(0, Math.min(1, mouthStretch * 5)); // 5倍灵敏度放大

    // 2. 挑眉系数：眉毛上移相对于平静时的偏移
    const browLiftDelta = ((currentData.leftBrowDist / nb.leftBrowDist + currentData.rightBrowDist / nb.rightBrowDist) / 2) - 1;
    this.metrics.browLift = Math.max(0, Math.min(1, browLiftDelta * 6));

    // 3. 嘴巴张开程度 (绝对位移 / 归一化)
    const mouthOpenDelta = (currentData.mouthHeight - nb.mouthHeight) / 10;
    this.metrics.mouthOpen = Math.max(0, Math.min(1, mouthOpenDelta));

    // 4. 眯眼/紧张度：眼睑间距缩小的比例
    const eyeShrink = 1 - ((currentData.leftEyeH + currentData.rightEyeH) / (nb.leftEyeH + nb.rightEyeH));
    this.metrics.squint = Math.max(0, Math.min(1, eyeShrink * 4));

    this.determineEmotion();
  }

  determineEmotion() {
    let emotion = '平静';
    let emoji = '😐';
    let conf = 0.5;

    // 逻辑判定：基于肌肉动作组合
    if (this.metrics.smile > 0.4) {
      emotion = '喜悦'; emoji = '😊'; conf = this.metrics.smile;
    } else if (this.metrics.browLift > 0.5 && this.metrics.mouthOpen > 0.3) {
      emotion = '惊讶'; emoji = '😲'; conf = (this.metrics.browLift + this.metrics.mouthOpen) / 2;
    } else if (this.metrics.browLift > 0.4 && this.metrics.smile < 0.2) {
      emotion = '忧虑'; emoji = '😟'; conf = this.metrics.browLift;
    } else if (this.metrics.squint > 0.7 && this.metrics.mouthOpen < 0.2) {
      emotion = '专注/愤怒'; emoji = '😠'; conf = this.metrics.squint;
    } else if (this.metrics.mouthOpen > 0.6) {
      emotion = '大笑'; emoji = '😆'; conf = this.metrics.mouthOpen;
    }

    this.updateUI(emotion, emoji, conf);
  }

  updateUI(label, emoji, conf) {
    if (this.mainResultEl) {
      this.mainResultEl.innerHTML = `
        <span class="emotion-emoji">${emoji}</span>
        <span class="emotion-text">${label}</span>
      `;
    }
    if (this.confBar) {
      this.confBar.style.width = `${Math.round(conf * 100)}%`;
    }

    // 记录微表情记录
    const now = Date.now();
    if (conf > 0.6 && label !== this.lastDetectedEmotion && (now - this.lastLoggedTime > 2500)) {
      this.lastDetectedEmotion = label;
      this.lastLoggedTime = now;
      this.addHistoryRecord(label, emoji, conf);
    }
  }

  addHistoryRecord(label, emoji, score) {
    if (!this.historyContainer) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
      <span class="label">${emoji} ${label}</span>
      <span class="score">${Math.round(score * 100)}%</span>
      <span class="time">${time}</span>
    `;
    this.historyContainer.prepend(item);
    if (this.historyContainer.children.length > 8) {
      this.historyContainer.removeChild(this.historyContainer.lastChild);
    }
  }

  showError(msg) {
    this.loadingScreen.innerHTML = `<div class="card" style="padding:24px; color:#ff4d4d; border:1px solid #ff4d4d">
      <h3>🚨 初始化状态: ${msg}</h3>
      <button onclick="location.reload()" style="margin-top:16px; padding:8px 16px">重试</button>
    </div>`;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new MicroEmotionDetector();
});
