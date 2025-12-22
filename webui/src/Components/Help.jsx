import './Help.css'
function Help({ language }) {
    if (language === '简体中文') {
        return (
            <div className="HelpContainer">
                <strong>帮助（简体中文）</strong>
                <p>1. 使用方法</p>
                <ul>
                    <li>选择待处理图片与保存位置（待处理图片可选单张图片或者整个文件夹）</li>
                    <li>选择模型，如果有需要，展开高级设置进行更多配置</li>
                    <li>点击开始处理，等待完成</li>
                </ul>

                <p>2. 模型比较</p>
                <figure><table>
                    <thead>
                        <tr><th>模型名称</th><th>描述</th></tr></thead>
                    <tbody>
                        <tr><td>Real-ESRGAN-x4: Anime6B-Official</td><td>RealESRGAN官方提供的动画插画模型</td></tr>
                        <tr><td>Real-ESRGAN-x4: jp_Illustration-fix1-d</td><td>适用于日系插画，一般修复强度（去模糊，JPEG还原），保留更多细节</td></tr>
                        <tr><td>Real-ESRGAN-x4: jp_Illustration-fix2</td><td>适用于日系插画，更多修复强度，少量丢失细节</td></tr>
                        <tr><td>Real-HATGAN-x4: jp_Illustration-fix1</td><td>适用于日系插画，一般修复强度</td></tr>
                        <tr><td>Real-HATGAN-x2: universal-fix1</td><td>适用于各种风格的2d插画，一般修复强度</td></tr>
                        <tr><td>Real-HATGAN-x2: jp_Illustration-fix1</td><td>适用于日系插画，一般修复强度</td></tr></tbody>
                    <tr><td>Real-HATGAN-x1: jp_Illustration-fixonly</td><td>适用于日系插画，仅修复图片，不进行放大</td></tr>
                    <tr><td>MoeIR: MoeIRv1</td><td>高效的插画修复模型，对X，Pixiv等压缩图像有很好的修复效果</td></tr>
                </table></figure>

                <p>3. 高级设置</p>
                <figure><table>
                    <thead>
                        <tr><th>参数名</th><th>描述</th></tr></thead>
                    <tbody>
                        <tr><td>缩放模式</td><td>手动缩放：使用模型超分图片至大于或等于放大倍率，随后缩放至目标大小；目标分辨率：软件自动根据输入的目标分辨率自动计算合适的超分次数并缩放</td></tr>
                        <tr><td>分块大小</td><td>越大占用显存越高，但一般处理更快一些</td></tr>
                        <tr><td>跳过透明通道</td><td>勾选后，透明图片则不使用超分辨率模型处理透明通道，而采用插值处理</td></tr>
                        <tr><td>缩放为/目标尺寸</td><td>格式：长x宽；或者分数，例如1/2。输入时注意：乘号为小写半角英文x，分数为英文斜杠。最终输出的图像分辨率为该值</td></tr>
                        <tr><td>GPU</td><td>1.0.2版本后，软件支持按GPU名称选择，当无法读取GPU名称时，依旧选择ID</td></tr>
                    </tbody>
                </table></figure>
                <p>4. 常见问题</p>
                <ul>
                    <li>Error:onnxruntimeException： 可能是显存爆了，尝试调低Tile size</li>
                    <li>GPU不工作/它在集显上跑： 尝试切换GPU</li>
                    <li>Win11无法运行/其他：考虑发Issue，并附带报错信息，以及触发过程</li>
                    <li>终端显示gpu enmuerate failed.：读取GPU名称失败，不影响使用，可使用ID选择</li>
                </ul>
            </div>);
    }
    else {
        return (
            <div className="HelpContainer">
                <strong>Help (English)</strong>
                <p>1. How to Use</p>
                <ul>
                    <li>Select the image(s) to process and the output location (you can choose a single image or an entire folder).</li>
                    <li>Select a model. If needed, expand the Advanced Settings for further configuration.</li>
                    <li>Click Start and wait for the process to complete.</li>
                </ul>
                <p>2. Model Compare</p>
                <figure>
                    <table>
                        <thead>
                            <tr><th>Model name</th><th>Description</th></tr></thead>
                        <tbody>
                            <tr><td>Real-ESRGAN-x4: Anime6B-Official</td><td>RealESRGAN Official Animated Illustration Model</td></tr>
                            <tr><td>Real-ESRGAN-x4: jp_Illustration-fix1-d</td><td>Suitable for Japanese Style illustration, general restoration strength (de-blurring, JPEG restoration), more details retained</td></tr>
                            <tr><td>Real-ESRGAN-x4: jp_Illustration-fix2</td><td>Suitable for Japanese Style illustrations, more restoration, small amount of missing details</td></tr>
                            <tr><td>Real-HATGAN-x4: jp_Illustration-fix1</td><td>Suitable for Japanese Style illustrations, general restoration strength</td></tr>
                            <tr><td>Real-HATGAN-x2: universal-fix1</td><td>Suitable for all styles of 2d illustration, general restoration strength</td></tr>
                            <tr><td>Real-HATGAN-x2: jp_Illustration-fix1</td><td>Suitable for Japanese Style illustrations, general restoration of intensity</td></tr></tbody>
                        <tr><td>Real-HATGAN-x1: jp_Illustration-fixonly</td><td>Suitable for Japanese Style illustration, only fix the picture, no enlargement</td></tr>
                        <tr><td>MoeIR: MoeIRv1</td><td>Efficient illustration restoration model, with good restoration effect on compressed images such as X and Pixiv</td></tr>
                    </table>
                </figure>
                <p>3. Advanced Settings</p>
                <figure>
                    <table>
                        <thead>
                            <tr>
                                <th>Parameter</th>
                                <th>Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Scaling Mode</td>
                                <td>
                                    Manual Scaling: The model upscales the image to a size greater than or equal to the scale factor, then resizes it to the target size.
                                    <br />
                                    Target Resolution: The software automatically calculates the required number of upscaling passes based on the specified target resolution and resizes accordingly.
                                </td>
                            </tr>
                            <tr>
                                <td>Tile Size</td>
                                <td>Larger values consume more GPU memory, but usually result in faster processing.</td>
                            </tr>
                            <tr>
                                <td>Skip Alpha Channel</td>
                                <td>When enabled, transparent images will not use the super-resolution model on the alpha channel; interpolation will be used instead.</td>
                            </tr>
                            <tr>
                                <td>Resize To / Target Size</td>
                                <td>
                                    Format: width x height, or a fraction such as 1/2.
                                    <br />
                                    Note: Use a lowercase English "x" for multiplication and a forward slash "/" for fractions.
                                    <br />
                                    The final output resolution will match this value.
                                </td>
                            </tr>
                            <tr>
                                <td>GPU</td>
                                <td>
                                    Starting from version 1.0.2, GPUs can be selected by name.
                                    If the GPU name cannot be detected, selection by GPU ID is still available.
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </figure>

                <p>4. FAQ</p>
                <ul>
                    <li>Error: onnxruntimeException: This is likely caused by insufficient GPU memory. Try reducing the tile size.</li>
                    <li>GPU not working / running on integrated graphics: Try switching to a different GPU.</li>
                    <li>Cannot run on Windows 11 / other issues: Consider opening an Issue and include error messages and reproduction steps.</li>
                    <li>Terminal shows "gpu enumerate failed": Failed to read GPU names. This does not affect functionality; you can select the GPU by ID instead.</li>
                </ul>

            </div>);
    }
}

export default Help;