# AI 细微表情识别系统 (H5端)

本项目是一个轻量化的面部表情识别 (FER) 系统，专为移动端渲染和 H5 应用优化。

## 核心特性
- **模型**: EfficientNet-B0 (轻量级 SOTA 架构)
- **人脸追踪**: MediaPipe Face Detection
- **推理引擎**: TensorFlow.js (支持 WebGL)
- **UI**: 现代深色模式与玻璃拟态设计

## 如何部署你的 EfficientNet-B0 模型

1. **训练与导出**:
   在 PyTorch/TensorFlow 中完成模型训练后，导出为 `SavedModel` 或 `Keras H5` 格式。

2. **转换模型**:
   安装 `tensorflowjs` 转换工具：
   ```bash
   pip install tensorflowjs
   ```
   执行转换命令（建议开启分片）：
   ```bash
   tensorflowjs_converter --input_format=keras --output_format=tfjs_layers_model ./your_model.h5 ./public/models/efficientnet_b0/
   ```

3. **集成代码**:
   修改 `main.js` 中的 `loadModels` 方法：
   ```javascript
   this.classifier = await tf.loadLayersModel('/models/efficientnet_b0/model.json');
   ```

4. **预处理注意**:
   EfficientNet-B0 默认要求输入为 `224x224x3`。代码中已实现 `tf.image.cropAndResize` 逻辑。

## 开发运行
```bash
npm install
npm run dev
```
访问 `http://localhost:3000` 即可开始识别。
