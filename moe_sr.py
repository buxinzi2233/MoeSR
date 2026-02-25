import math
import traceback
from pathlib import Path
import json
import time

import eel
import numpy as np
import cv2

from onnx_infer import OnnxSRInfer
from gpu_enum import GPUEnum, select_better_gpu


class ModelInfo:
    def __init__(self, name, path, scale, algo, precision='fp32'):
        self.name = name
        self.path = str(path)
        self.scale = scale
        self.algo = algo
        self.precision = precision


class ModelManager:
    def __init__(self, model_root='models'):
        self.model_root = Path(model_root)
        self.model_list: list[ModelInfo] = self._scan_models()

    def _scan_models(self):
        models = []
        for model_file in self.model_root.rglob('*.onnx'):
            try:
                # model_file.parts an tuple like: ('E:', 'MoeSR', 'models', 'real-esrgan', 'x4', 'model.onnx')
                # The last three parts are what we need.
                scale_dir_name = model_file.parts[-2]
                algo_name = model_file.parts[-3]
                scale = int(scale_dir_name.replace('x', ''))
                precision = 'fp32'
                if 'fp16' in model_file.stem:
                    precision = 'fp16'
                models.append(ModelInfo(model_file.stem, model_file, scale, algo_name, precision))
            except:
                print(f"Skip unresolvable model paths: {model_file}")
                continue
        return models

    def find_model(self, name, algo) -> ModelInfo:
        for model in self.model_list:
            if model.name == name and model.algo == algo:
                return model
        return None

    def get_models_by_algo(self, algo_name):
        return [m.name for m in self.model_list if m.algo == algo_name]


class SRManager:
    def __init__(self, model_manager):
        self.model_manager = model_manager
        self._sr_instance = None
        # Use file path to determine unique values to avoid multiple judgments
        self._current_model_path = None
        self._current_gpuid = None

    def get_instance(self, model_name, algo_name, gpuid, progress_setter):
        model_info: ModelInfo = self.model_manager.find_model(model_name, algo_name)
        if (self._sr_instance is None or
            self._current_model_path != model_info.path or
                self._current_gpuid != gpuid):

            print(f"Creating/Switching an SR Instance. Model: {model_info.path}, GPU ID: {gpuid}")
            if self._sr_instance:
                del self._sr_instance

            provider_options = [{'device_id': gpuid}] if gpuid >= 0 else None
            self._sr_instance = OnnxSRInfer(
                model_info.path, model_info.scale, model_info.name, model_info.precision,
                provider_options=provider_options,
                progress_setter=progress_setter)
            self._current_model_path = model_info.path
            self._current_gpuid = gpuid

        return self._sr_instance, model_info

    def reset(self):
        if self._sr_instance:
            del self._sr_instance
        self._sr_instance = None
        self._current_model_path = None
        self._current_gpuid = None


port = 10721
model_manager = ModelManager()
sr_manager = SRManager(model_manager)
g_progress_state = {}
try:
    gpu_enumerator = GPUEnum()
    gpu_dict = gpu_enumerator.gpu_dict()
    gpu_list = gpu_enumerator.gpu_list()
except:
    print('gpu enmuerate failed.')
    gpu_dict = None
    gpu_list = [str(i) for i in range(16)]

eel.init('webui/dist', custom_js_func=['handleSetProgress', 'showError', 'handleSetProcessState'])

# Sliding window size for ETR calculation
SLIDING_WINDOW_SIZE = 5


@eel.expose
def py_get_model_list(algo_name):
    return model_manager.get_models_by_algo(algo_name)


@eel.expose
def py_get_all_models():
    """Get all models with algorithm info for workflow"""
    result = []
    for model in model_manager.model_list:
        result.append({
            'name': model.name,
            'algo': model.algo,
            'scale': model.scale,
            'displayName': f"{model.algo}: {model.name}"
        })
    return result


@eel.expose
def py_get_gpu_list():
    return select_better_gpu(gpu_list)


@eel.expose
def py_get_settings():
    try:
        with open('settings.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


@eel.expose
def py_save_settings(new_settings):
    try:
        with open('settings.json', 'w', encoding='utf-8') as f:
            json.dump(new_settings, f, ensure_ascii=False, indent=4)
        return 0
    except Exception as e:
        return -1


@eel.expose
def py_get_workflow_list():
    """Get list of saved workflows"""
    workflow_dir = Path('workflows')
    workflow_dir.mkdir(exist_ok=True)
    
    workflows = []
    for file in workflow_dir.glob('*.json'):
        workflows.append(file.stem)
    return workflows


@eel.expose
def py_load_workflow(name):
    """Load a workflow by name"""
    try:
        workflow_path = Path('workflows') / f"{name}.json"
        if workflow_path.exists():
            with open(workflow_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return None
    except Exception as e:
        print(f"Error loading workflow {name}: {e}")
        return None


@eel.expose
def py_save_workflow(name, data):
    """Save a workflow"""
    try:
        workflow_dir = Path('workflows')
        workflow_dir.mkdir(exist_ok=True)
        
        workflow_path = workflow_dir / f"{name}.json"
        with open(workflow_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        return True
    except Exception as e:
        print(f"Error saving workflow {name}: {e}")
        return False


def seconds_to_hms(seconds):
    if seconds is None or seconds < 0:
        return '--:--:--'
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    seconds = int(seconds % 60)
    return f"{hours:0>2d}:{minutes:0>2d}:{seconds:0>2d}"


def progress_setter(progress, current_time, total_img_num, processed_img_num):
    state = g_progress_state

    progress_percent = round(progress * 100)
    total_progress_percent = round((processed_img_num + progress) / total_img_num * 100)

    etr_str = '--:--:--'
    total_etr_str = '--:--:--'

    # Initialize history list for sliding window
    if 'history' not in state:
        state['history'] = []
    
    history = state['history']
    history.append({'progress': progress, 'time': current_time})
    
    # Keep window size
    if len(history) > SLIDING_WINDOW_SIZE:
        history.pop(0)
    
    # Calculate average speed using sliding window
    if len(history) >= 2:
        oldest = history[0]
        newest = history[-1]
        
        time_delta = newest['time'] - oldest['time']
        progress_delta = newest['progress'] - oldest['progress']
        
        if progress_delta > 1e-6 and time_delta > 0:
            speed = progress_delta / time_delta  # progress per second
            remaining_progress = 1 - progress
            etr = remaining_progress / speed
            
            total_remaining = total_img_num - processed_img_num - progress
            total_etr = total_remaining / speed
            
            etr_str = seconds_to_hms(etr)
            total_etr_str = seconds_to_hms(total_etr)

    progress_str = f'{progress_percent}% ETR:{etr_str}'
    total_progress_str = f'{total_progress_percent}% ETR:{total_etr_str}'
    eel.handleSetProgress(progress_percent, progress_str, total_progress_str)


def show_error(error_text):
    eel.showError(error_text)


def set_process_state(state):
    eel.handleSetProcessState(state)


def workflow_progress_setter(step_progress, current_time, node_index, node_type,
                             processed_img_num, total_img_num):
    """Workflow progress callback - uses same format as normal progress_setter
    
    Args:
        step_progress: Current inference node tile progress (0-1), -1 for non-inference nodes
        current_time: Current timestamp
        node_index: Current node index (1-based)
        node_type: Current node type (inference/scale/label/jump/conditional_jump)
        processed_img_num: Number of processed images
        total_img_num: Total number of images
    """
    state = g_progress_state
    
    etr_str = '--:--:--'
    step_percent = 0
    
    # Calculate ETR using sliding window (only for inference nodes)
    if step_progress >= 0:
        step_percent = round(step_progress * 100)
        
        if 'history' not in state:
            state['history'] = []
        
        history = state['history']
        history.append({'progress': step_progress, 'time': current_time})
        
        if len(history) > SLIDING_WINDOW_SIZE:
            history.pop(0)
        
        if len(history) >= 2:
            oldest = history[0]
            newest = history[-1]
            
            time_delta = newest['time'] - oldest['time']
            progress_delta = newest['progress'] - oldest['progress']
            
            if progress_delta > 1e-6 and time_delta > 0:
                speed = progress_delta / time_delta
                remaining_progress = 1 - step_progress
                etr = remaining_progress / speed
                etr_str = seconds_to_hms(etr)
    
    # Format node type display
    node_type_display = node_type.capitalize()
    if node_type == 'conditional_jump':
        node_type_display = 'Conditional'
    
    # Format progress text: "Node 5: Inference - 45% ETR:00:01:23" or "Node 3: Scale"
    if node_type == 'inference' and step_progress >= 0:
        progress_str = f"Node {node_index}: {node_type_display} - {step_percent}% ETR:{etr_str}"
    else:
        progress_str = f"Node {node_index}: {node_type_display}"
    
    # Total progress for batch processing
    total_progress_percent = round(processed_img_num / total_img_num * 100) if total_img_num > 0 else 0
    total_progress_str = f"{processed_img_num}/{total_img_num} ({total_progress_percent}%)"
    
    # Use same callback as normal inference
    eel.handleSetProgress(step_percent, progress_str, total_progress_str)


def get_unique_filename(filepath: Path) -> Path:
    counter = 1
    new_filepath = filepath

    while new_filepath.exists():
        new_filepath = filepath.with_name(f"{filepath.stem}_{counter}{filepath.suffix}")
        counter += 1
    return new_filepath


def format_output_filename(template: str, filestem: str, scale: int, model_name: str) -> str:
    """
    Format output filename based on template with placeholders.
    Supported placeholders: {filestem}, {scale}, {model_name}
    Truncates filename to 260 characters if exceeded.
    """
    filename = template.replace('{filestem}', filestem)
    filename = filename.replace('{scale}', str(scale))
    filename = filename.replace('{model_name}', model_name)
    
    # Truncate filename if it exceeds 260 characters (Windows MAX_PATH limit)
    if len(filename) > 260:
        # Preserve file extension
        ext_start = filename.rfind('.')
        if ext_start > 0:
            ext = filename[ext_start:]
            filename = filename[:260 - len(ext)] + ext
        else:
            filename = filename[:260]
    
    return filename


def parse_resolution_str(resolution: str, w, h):
    if 'x' in resolution.lower():
        parts = resolution.lower().split('x')
        try:
            target_w = int(parts[0])
            target_h = int(h * target_w / w)
            return (target_w, target_h)
        except:
            print(f"Invalid size parameter: {resolution}")
    elif '/' in resolution:
        parts = resolution.split('/')
        try:
            num = float(parts[0])
            den = float(parts[1])
            ratio = num / den
            target_w = int(w * ratio)
            target_h = int(h * ratio)
            return (target_w, target_h)
        except:
            print(f"Invalid scale parameter: {resolution}")


def parse_gpu_str(gpu: str):
    preset_ids = [str(i) for i in range(16)]
    if gpu in preset_ids:
        return int(gpu)
    elif gpu_dict:
        gpu_id = gpu_dict[gpu]
        return gpu_id
    else:
        return 0


@eel.expose
def py_run_process(modelName, tileSize, scale, isSkipAlpha, resizeTo: str, inputType, inputImage, outputPath, gpuid, algoName,
                   scalingMode='manual', targetResloution=''):
    # scalingMode: manual/target
    global g_progress_state
    g_progress_state = {'last_progress': None, 'last_time': None}
    
    # Load custom filename format from settings
    settings = py_get_settings()
    custom_filename_format = settings.get('customFilenameFormat', '{filestem}_MoeSR_x{scale}_{model_name}.png')
    
    # fix params
    if algoName == 'moe-ir':
        tileSize = 256-16
        scale = 1
    try:
        # parse ui gpu str
        real_gpu_id = parse_gpu_str(gpuid)
        sr_instance, model = sr_manager.get_instance(modelName, algoName, int(real_gpu_id), progress_setter)
        sr_instance.alpha_upsampler = 'interpolation' if isSkipAlpha else 'default'

        if inputType == 'Folder':
            input_folder = Path(inputImage)
            imgs_in = list(input_folder.glob('*.jpg')) + list(input_folder.glob('*.png'))
        else:
            imgs_in = [Path(inputImage)]

        if not imgs_in:
            return

        sr_instance.total_img_num = len(imgs_in)
        sr_instance.processed_img_num = 0

        for img_path in imgs_in:
            g_progress_state = {'last_progress': None, 'last_time': None}

            img = cv2.imdecode(np.fromfile(img_path, dtype=np.uint8), cv2.IMREAD_UNCHANGED)
            if img is None:
                print(f"Unable to load image {img_path}, skipped.")
                sr_instance.processed_img_num += 1
                continue

            h, w = img.shape[:2]
            sr_img = sr_instance.universal_process_pipeline(img, tile_size=tileSize)

            # calc target scale
            if scalingMode == 'target':
                parts = targetResloution.lower().split('x')
                scale = math.ceil(int(parts[0]) / w)

            # Target scale > model scale, repeat the process
            if scale > model.scale and model.scale > 1:
                scale_log = math.log(scale, model.scale)
                total_times = math.ceil(scale_log)
                for _ in range(total_times - 1):
                    sr_img = sr_instance.universal_process_pipeline(sr_img, tile_size=tileSize)
            sr_h, sr_w = sr_img.shape[:2]

            # resize
            target_h, target_w = None, None

            if scalingMode == 'target':
                target_w, target_h = parse_resolution_str(targetResloution, w, h)
            elif scalingMode == 'manual' and resizeTo:
                target_w, target_h = parse_resolution_str(resizeTo, w, h)
            # No 'resizeTo' set, but 'ui scale' is not equal to the 'model scale'
            elif scalingMode == 'manual' and sr_w != w*scale:
                target_w = int(w * scale)
                target_h = int(h * scale)

            if target_w and target_h:
                # need to use the final image after super-resolution
                if sr_w > target_w:
                    # reduce
                    img_out = cv2.resize(sr_img, (target_w, target_h), interpolation=cv2.INTER_AREA)
                else:
                    img_out = cv2.resize(sr_img, (target_w, target_h), interpolation=cv2.INTER_LANCZOS4)
            else:
                img_out = sr_img

            # save image
            output_folder = Path(outputPath)
            output_folder.mkdir(parents=True, exist_ok=True)
            base_name = img_path.stem
            
            # Use custom filename format
            output_filename = format_output_filename(
                custom_filename_format,
                filestem=base_name,
                scale=scale,
                model_name=model.name
            )
            final_output_path = output_folder / output_filename

            if final_output_path.exists():
                final_output_path = get_unique_filename(final_output_path)

            cv2.imencode('.png', img_out)[1].tofile(final_output_path)
            sr_instance.processed_img_num += 1

        set_process_state('finish')

    except Exception as e:
        sr_manager.reset()
        error_message = traceback.format_exc()
        print(error_message)
        show_error(error_message)
        set_process_state('error')


@eel.expose
def py_run_workflow(workflow_data):
    """Execute workflow pipeline"""
    global g_progress_state
    g_progress_state = {'last_progress': None, 'last_time': None}
    
    try:
        # Load custom filename format from settings
        settings = py_get_settings()
        custom_filename_format = settings.get('customFilenameFormat', '{filestem}_MoeSR_x{scale}_{model_name}.png')
        
        # Parse input
        input_config = workflow_data.get('input', {})
        output_config = workflow_data.get('output', {})
        nodes = workflow_data.get('nodes', [])
        
        input_path = input_config.get('path', '')
        input_type = input_config.get('inputType', 'Image')
        output_path = output_config.get('path', '')
        
        if not input_path or not output_path:
            set_process_state('error')
            return
        
        # Load images
        if input_type == 'Folder':
            input_folder = Path(input_path)
            imgs_in = list(input_folder.glob('*.jpg')) + list(input_folder.glob('*.png'))
        else:
            imgs_in = [Path(input_path)]
        
        if not imgs_in:
            set_process_state('finish')
            return
        
        total_img_num = len(imgs_in)
        processed_img_num = 0
        
        # Build label index map
        label_index_map = {}
        for i, node in enumerate(nodes):
            if node.get('type') == 'label':
                label_name = node.get('config', {}).get('name', '')
                if label_name:
                    label_index_map[label_name] = i
        
        # Process each image
        for img_path in imgs_in:
            g_progress_state = {'last_progress': None, 'last_time': None}
            
            img = cv2.imdecode(np.fromfile(img_path, dtype=np.uint8), cv2.IMREAD_UNCHANGED)
            if img is None:
                print(f"Unable to load image {img_path}, skipped.")
                processed_img_num += 1
                continue
            
            current_scale = 1
            last_model_name = 'unknown'
            
            # Execute workflow nodes
            current_index = 0
            max_steps = 1000  # Prevent infinite loops
            step_count = 0
            
            while current_index < len(nodes) and step_count < max_steps:
                step_count += 1
                node = nodes[current_index]
                node_type = node.get('type', '')
                config = node.get('config', {})
                
                # Send progress update for non-inference nodes
                if node_type != 'inference':
                    workflow_progress_setter(-1, time.time(), current_index + 1, node_type,
                                            processed_img_num, total_img_num)
                
                if node_type == 'inference':
                    # Reset history for new inference node
                    g_progress_state = {'history': []}
                    
                    # Run inference
                    algo_name = config.get('algoName', '')
                    model_name = config.get('modelName', '')
                    tile_size = config.get('tileSize', 64)
                    gpu_id = config.get('gpuId', '0')
                    skip_alpha = config.get('skipAlpha', False)
                    
                    if algo_name == 'moe-ir':
                        tile_size = 256 - 16
                    
                    real_gpu_id = parse_gpu_str(gpu_id)
                    
                    # Capture current node index for closure
                    _node_index = current_index + 1
                    _total_img_num = total_img_num
                    _processed_img_num = processed_img_num
                    
                    def make_workflow_progress_callback(node_idx, total_imgs, processed_imgs):
                        def callback(progress, current_time, total, processed):
                            workflow_progress_setter(progress, current_time, node_idx, 'inference',
                                                    processed_imgs, total_imgs)
                        return callback
                    
                    progress_callback = make_workflow_progress_callback(_node_index, _total_img_num, _processed_img_num)
                    
                    sr_instance, model = sr_manager.get_instance(model_name, algo_name, int(real_gpu_id), progress_callback)
                    sr_instance.alpha_upsampler = 'interpolation' if skip_alpha else 'default'
                    sr_instance.total_img_num = 1
                    sr_instance.processed_img_num = 0
                    
                    img = sr_instance.universal_process_pipeline(img, tile_size=tile_size)
                    current_scale *= model.scale
                    last_model_name = model.name
                    current_index += 1
                    
                elif node_type == 'scale':
                    # Run scale
                    value = config.get('value', '')
                    if value:
                        h, w = img.shape[:2]
                        result = parse_resolution_str(value, w, h)
                        if result:
                            target_w, target_h = result
                            if w > target_w:
                                img = cv2.resize(img, (target_w, target_h), interpolation=cv2.INTER_AREA)
                            else:
                                img = cv2.resize(img, (target_w, target_h), interpolation=cv2.INTER_LANCZOS4)
                    current_index += 1
                    
                elif node_type == 'label':
                    # Label node, just continue
                    current_index += 1
                    
                elif node_type == 'jump':
                    # Unconditional jump
                    jump_to = config.get('jumpTo', '')
                    if jump_to and jump_to in label_index_map:
                        current_index = label_index_map[jump_to]
                    else:
                        current_index += 1
                        
                elif node_type == 'conditional_jump':
                    # Conditional jump
                    h, w = img.shape[:2]
                    condition_type = config.get('conditionType', 'width')
                    operator = config.get('operator', 'gt')
                    compare_value = config.get('value', 0)
                    true_jump = config.get('trueJumpTo', '')
                    false_jump = config.get('falseJumpTo', '')
                    
                    # Get actual value
                    if condition_type == 'width':
                        actual_value = w
                    else:  # height
                        actual_value = h
                    
                    # Evaluate condition
                    condition_met = False
                    if operator == 'gt':
                        condition_met = actual_value > compare_value
                    elif operator == 'lt':
                        condition_met = actual_value < compare_value
                    elif operator == 'eq':
                        condition_met = actual_value == compare_value
                    
                    # Jump based on condition
                    if condition_met and true_jump and true_jump in label_index_map:
                        current_index = label_index_map[true_jump]
                    elif not condition_met and false_jump and false_jump in label_index_map:
                        current_index = label_index_map[false_jump]
                    else:
                        current_index += 1
                else:
                    current_index += 1
            
            # Save output
            output_folder = Path(output_path)
            output_folder.mkdir(parents=True, exist_ok=True)
            base_name = img_path.stem
            
            output_filename = format_output_filename(
                custom_filename_format,
                filestem=base_name,
                scale=current_scale,
                model_name=last_model_name
            )
            final_output_path = output_folder / output_filename
            
            if final_output_path.exists():
                final_output_path = get_unique_filename(final_output_path)
            
            cv2.imencode('.png', img)[1].tofile(final_output_path)
            processed_img_num += 1
        
        set_process_state('finish')
        
    except Exception as e:
        sr_manager.reset()
        error_message = traceback.format_exc()
        print(error_message)
        show_error(error_message)
        set_process_state('error')


if __name__ == '__main__':
    # Dev
    model_manager = ModelManager(r'E:\python\MoeSR\models')
    sr_manager = SRManager(model_manager)
    eel.start(
        'index.html',
        mode='custom',
        cmdline_args=['E:/python/MoeSR/electron/electron.exe', 'E:/python/MoeSR/electron_app/main.js'],
        port=port
    )

    # Release
    # eel.start(
    #     'index.html',
    #     mode='custom',
    #     cmdline_args=['electron/electron.exe', 'electron_app/main.js'],
    #     port=port
    #     )
