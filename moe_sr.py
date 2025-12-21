import math
import traceback
from pathlib import Path
import json

import eel
import numpy as np
import cv2

from onnx_infer import OnnxSRInfer


class ModelInfo:
    def __init__(self, name, path, scale, algo):
        self.name = name
        self.path = str(path)
        self.scale = scale
        self.algo = algo


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
                models.append(ModelInfo(model_file.stem, model_file, scale, algo_name))
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
            self._sr_instance = OnnxSRInfer(model_info.path, model_info.scale, model_info.name,
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

eel.init('webui/dist', custom_js_func=['handleSetProgress', 'showError', 'handleSetProcessState'])


@eel.expose
def py_get_model_list(algo_name):
    return model_manager.get_models_by_algo(algo_name)


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

    last_progress = state.get('last_progress')
    last_time = state.get('last_time')

    if last_progress is not None and last_time is not None and progress > last_progress:
        time_delta = current_time - last_time
        progress_delta = progress - last_progress

        if progress_delta > 1e-6:
            etr = time_delta * (1 - progress) / progress_delta
            total_etr = time_delta * (total_img_num - processed_img_num - progress) / progress_delta
            etr_str = seconds_to_hms(etr)
            total_etr_str = seconds_to_hms(total_etr)

    progress_str = f'{progress_percent}% ETR:{etr_str}'
    total_progress_str = f'{total_progress_percent}% ETR:{total_etr_str}'
    eel.handleSetProgress(progress_percent, progress_str, total_progress_str)

    state['last_progress'] = progress
    state['last_time'] = current_time


def show_error(error_text):
    eel.showError(error_text)


def set_process_state(state):
    eel.handleSetProcessState(state)


def get_unique_filename(filepath: Path) -> Path:
    counter = 1
    new_filepath = filepath

    while new_filepath.exists():
        new_filepath = filepath.with_name(f"{filepath.stem}_{counter}{filepath.suffix}")
        counter += 1
    return new_filepath


@eel.expose
def py_run_process(modelName, tileSize, scale, isSkipAlpha, resizeTo: str, inputType, inputImage, outputPath, gpuid, algoName):
    global g_progress_state
    g_progress_state = {'last_progress': None, 'last_time': None}
    # fix params
    if algoName == 'moe-ir':
        tileSize = 256-16
        scale = 1
    try:
        sr_instance, model = sr_manager.get_instance(modelName, algoName, int(gpuid), progress_setter)
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

            # Target scale > model scale, repeat the process
            if scale > model.scale and model.scale > 1:
                scale_log = math.log(scale, model.scale)
                total_times = math.ceil(scale_log)
                for _ in range(total_times - 1):
                    sr_img = sr_instance.universal_process_pipeline(sr_img, tile_size=tileSize)

            # resize
            target_h, target_w = None, None
            if resizeTo:
                if 'x' in resizeTo.lower():
                    parts = resizeTo.lower().split('x')
                    try:
                        target_w = int(parts[0])
                        target_h = int(h * target_w / w)
                    except:
                        print(f"Invalid size parameter: {resizeTo}")
                elif '/' in resizeTo:
                    parts = resizeTo.split('/')
                    try:
                        num = float(parts[0])
                        den = float(parts[1])
                        ratio = num / den
                        target_w = int(w * ratio)
                        target_h = int(h * ratio)
                    except:
                        print(f"Invalid scale parameter: {resizeTo}")
            elif scale != model.scale:
                target_w = int(w * scale)
                target_h = int(h * scale)

            if target_w and target_h:
                # reduce
                if w > target_w:
                    img_out = cv2.resize(sr_img, (target_w, target_h), interpolation=cv2.INTER_AREA)
                else:
                    img_out = cv2.resize(sr_img, (target_w, target_h), interpolation=cv2.INTER_LANCZOS4)
            else:
                img_out = sr_img

            # save image
            output_folder = Path(outputPath)
            output_folder.mkdir(parents=True, exist_ok=True)
            base_name = img_path.stem
            final_output_path = output_folder / f'{base_name}_MoeSR_{model.name}.png'

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
