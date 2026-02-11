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

这是一个不需要后台服务器、完全在手机前端运行的高精度表情识别方案。通过 478 个点的物理追踪，它避开了传统深度学习分类模型在复杂环境（光照、角度）下的不稳定性。

物理偏离算法 (Delta Calculation)：

1、笑容：现在是根据您嘴角拉伸的百分比来判断，即使是极其轻微的嘴角上扬也能被 5 倍灵敏度放大捕捉。
挑眉：通过测量眉毛相对于内眼角的垂直位移比率，精准识别惊讶或疑虑。
紧张/眯眼：通过计算眼睑间距缩小的物理占比，识别专注或微怒。
地标点可视化反馈：
2、保持了 478 个点的实时渲染，可以清楚地看到系统确实正在追踪您面部的每一寸肌肉变化。
3、如配合后端得到高置信度表情阈值，可以快速分析此人的心情状态。

*太初量化（武汉）AI科技有限公司*
