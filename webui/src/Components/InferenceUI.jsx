import './InferenceUI.css'
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Slider from '@mui/material/Slider';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import { Typography } from '@mui/material';
import { useState, useEffect } from 'react';
import Alert from '@mui/material/Alert';
import Collapse from '@mui/material/Collapse';
import SettingsIcon from '@mui/icons-material/Settings';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';

function ProgressTextDisplay({ singleProgressText, totalProgressText, isBatchProcess }) {
    if (isBatchProcess) {
        return (
            <Box>
                <Typography sx={{ margin: '0px 0px', fontSize: '0.8em' }}>{singleProgressText}</Typography>
                <Typography sx={{ margin: '0px 0px', fontSize: '0.8em' }}>{totalProgressText}</Typography>
            </Box>
        )
    }
    else {
        return (
            <Typography sx={{ margin: '0px 0px', fontSize: '0.96em' }}>{singleProgressText}</Typography>
        )
    }
}

async function getModelList(algoName, webDevMode) {
    if (webDevMode) {
        // for dev
        let dummyData;
        if (algoName === "real-esrgan") {
            dummyData = ["esrgan model1", "x4_jp_Illustration-fix1-d", "x2_jp_Illustration-fix1-d"]
        }
        else if (algoName === "real-hatgan") {
            dummyData = ["hatgan model1", "model2", "model3"]
        }
        else if (algoName === "moe-ir") {
            dummyData = ["model1", "model2", "model3"]
        }
        return dummyData
    }
    else {
        return await window.eel.py_get_model_list(algoName)()
    }
}

async function getGPUList(webDevMode) {
    if (webDevMode) {
        return ['0', 'NVIDIA GeForce RTX 2060']
    } else {
        return await window.eel.py_get_gpu_list()()
    }
}

function InferenceUI({ algoName, webDevMode, texts, alwaysShowAdvanced }) {

    // AlgoName : real-esrgan or real-hatgan
    var algoTitle;
    if (algoName === "real-esrgan") {
        algoTitle = <h3><strong>R</strong>eal-<strong>ESR</strong>GAN</h3>
    }
    else if (algoName === "real-hatgan") {
        algoTitle = <h3><strong>R</strong>eal-<strong>HAT</strong>GAN</h3>
    }
    else if (algoName === "moe-ir") {
        algoTitle = <h3><strong>M</strong>oe-<strong>I</strong>R</h3>
    }
    // process state Alert
    let stateAlert;
    const [processState, setProcessState] = useState("idle");
    const [showAdvanced, setShowAdvanced] = useState(false);

    useEffect(() => {
        if (alwaysShowAdvanced) {
            setShowAdvanced(true);
        }
    }, [alwaysShowAdvanced]);

    const toggleAdvanced = () => {
        setShowAdvanced(!showAdvanced);
    };

    function handleSetProcessState(state) {
        setProcessState(state)
        if (state === 'finish') {
            setInfering(false)
        }
    }
    function handleAlertClose() {
        setProcessState('idle')
    }

    if (processState === "finish") {
        stateAlert = <Alert severity="success" onClose={() => { handleAlertClose() }}
        >{texts.inferAlertFinish}</Alert>;
    }
    else if (processState === "error") {
        stateAlert = <Alert severity="error" onClose={() => { handleAlertClose() }}
        >{texts.inferAlertError}</Alert>;
    }
    else if (processState === "idle") {
        stateAlert = <></>
    }
    else if (processState === "missing param") {
        stateAlert = <Alert severity="info" onClose={() => { handleAlertClose() }}
        >{texts.inferAlertMissingParam}</Alert>;
    }
    function checkInput(modelName, inputImage, outputPath) {
        if (!modelName || !inputImage || !outputPath) {
            setInfering(false);
            setProcessState('missing param');
            return false
        }
        else {
            return true
        }
    }

    function runProcess(modelName, tileSize, scale, isSkipAlpha, resizeTo, inputType, inputImage, outputPath, GPUID, scalingMode) {
        if (webDevMode) {
            // for dev
            console.log(modelName, tileSize, scale, isSkipAlpha, resizeTo, inputType, inputImage, outputPath, GPUID, scalingMode)
        }
        else {
            if (checkInput(modelName, inputImage, outputPath)) {
                window.eel.py_run_process(modelName, tileSize, scale, isSkipAlpha, resizeTo, inputType, inputImage, outputPath, GPUID, algoName, scalingMode)
            }
        }
    }
    function getIsDisableTileAndScaleSetting() {
        if (algoName === 'moe-ir') {
            return true
        } else {
            return false
        }
    }
    // Options
    const [modelOptions, setModelOptions] = useState([])
    const [gpuOptions, setGpuOptions] = useState([])
    // Infer Config
    const [modelName, setModelName] = useState(null);
    const [tileSize, setTileSize] = useState(64);
    const [scale, setScale] = useState(4);
    const [isSkipAlpha, setIsSkipAlpha] = useState(false);
    const [resizeTo, setResizeTo] = useState(null);
    const [scalingMode, setScalingMode] = useState('manual');
    const [targetSize, setTatgetSize] = useState('')
    // Process Config
    // input type: Image or Folder
    const [inputType, setInputType] = useState('Image');
    const [isBatchProcess, setIsBatchProcess] = useState(false);
    const [inputImage, setInputImage] = useState('');
    const [outputPath, setOutputPath] = useState('');
    const [progress, setProgress] = useState(0);
    const [singleProgressText, setSingleProgressText] = useState('0% ETR:--:--:--');
    const [totalProgressText, setTotalProgressText] = useState('0% ETR:--:--:--');
    const [GPUID, setGPUID] = useState(0);
    const [infering, setInfering] = useState(false);
    let inputText = texts.inferInputImage;

    const [anchorEl, setAnchorEl] = useState(null);
    const openMenu = Boolean(anchorEl);
    const handleClickMenu = (event) => {
        setAnchorEl(event.currentTarget);
    };
    const handleCloseMenu = () => {
        setAnchorEl(null);
    };

    // Backend communication
    useEffect(() => {
        // Runs ONCE after initial rendering
        getModelList(algoName, webDevMode).then(result => { setModelOptions(result) });
        getGPUList(webDevMode).then(result => {
            setGpuOptions(result)
            if (Array.isArray(result) && result.length > 0) {
                setGPUID(result[0]);
            }
        });
        console.log('Effect run ' + algoName);
    }, [algoName, webDevMode]);
    if (!webDevMode) {
        window.eel.expose(handleSetProgress, 'handleSetProgress');
        window.eel.expose(handleSetProcessState, 'handleSetProcessState');
        window.eel.expose(showError, 'showError');
    }
    function showError(errorText) {
        window.electronAPI.showError(errorText);
        setProcessState('idle');
    }
    function handleSetProgress(progressNum, singleProgressText, totalProgressText) {
        setProgress(progressNum);
        setSingleProgressText(singleProgressText);
        setTotalProgressText(totalProgressText)
    }
    async function handleInputSelect(mode) {
        handleCloseMenu();
        let input;
        const result = await window.electronAPI.openFileOrFolder(mode);
        if (result) {
            setInputImage(result.path);
            if (result.type === 'directory') {
                setInputType('Folder');
                setIsBatchProcess(true);
            } else {
                setInputType('Image');
                setIsBatchProcess(false);
            }
        }
        input = document.getElementById('input-image');
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    }
    async function handleOutputSelect() {
        let input;
        const result = await window.electronAPI.openFileOrFolder('folder');
        if (result) {
            setOutputPath(result.path);
        }
        input = document.getElementById('output-path');
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    }
    function handelSetModelName(modelName) {
        setModelName(modelName);
        // Automatically synchronize Scale based on model name
        const match = modelName.match(/x(\d+)_/);

        if (match) {
            const numberStr = match[1];
            const number = parseInt(numberStr);
            setScale(number)
        }
    }
    return (
        <div className='InferUI'>
            {algoTitle}
            <div className="ConfigureArea">
                <div className="MainContent">
                    {/* Input & Output Row */}
                    <Box sx={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '12px' }}>
                        {/* Input Image/Folder */}
                        <Box sx={{ flex: 1, minWidth: '300px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography sx={{ margin: '15px 0px', minWidth: '80px', textAlign: 'left' }}>{inputText}</Typography>
                            <TextField id="input-image" variant="standard" sx={{ margin: '10px 5px', flexGrow: 1 }}
                                value={inputImage} />
                            <Button variant="outlined" sx={{ width: '80px' }}
                                onClick={handleClickMenu}
                            >{texts.inferSelectButton}</Button>
                            <Menu
                                id="basic-menu"
                                anchorEl={anchorEl}
                                open={openMenu}
                                onClose={handleCloseMenu}
                                // MenuListProps={{
                                //     'aria-labelledby': 'basic-button',
                                // }}
                                slotProps={{
                                    list: {
                                        'aria-labelledby': 'basic-button',
                                    }
                                }}
                            >
                                <MenuItem onClick={() => handleInputSelect('file')}>{texts.inferInputImage.replace(/[:：]$/, '')}</MenuItem>
                                <MenuItem onClick={() => handleInputSelect('folder')}>{texts.inferInputFolder.replace(/[:：]$/, '')}</MenuItem>
                            </Menu>
                        </Box>

                        {/* Output Path */}
                        <Box sx={{ flex: 1, minWidth: '300px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography sx={{ margin: '15px 0px', minWidth: '80px', textAlign: 'left' }}>{texts.inferSaveTo}</Typography>
                            <TextField id="output-path" variant="standard" sx={{ margin: '10px 5px', flexGrow: 1 }} value={outputPath} />
                            <Button variant="outlined" sx={{ width: '80px' }} onClick={handleOutputSelect}>{texts.inferSelectButton}</Button>
                        </Box>
                    </Box>

                    {/* Model Selection & Advanced Settings Button Row */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', gap: '20px' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
                            <Typography sx={{ margin: '15px 0px', minWidth: '80px', textAlign: 'left' }}>{texts.inferModel}</Typography>
                            <Autocomplete
                                disablePortal
                                id="modelFile"
                                options={modelOptions}
                                sx={{ flexGrow: 1 }}
                                onChange={(event, newValue) => {
                                    handelSetModelName(newValue);
                                }}
                                renderInput={(params) => <TextField {...params} variant='standard' />}
                            />
                        </Box>

                        <Button
                            startIcon={<SettingsIcon />}
                            onClick={toggleAdvanced}
                            sx={{ color: showAdvanced ? '#239dda' : '#999', textTransform: 'none', whiteSpace: 'nowrap' }}
                        >
                            {texts.inferAdvancedSettings}
                        </Button>
                    </Box>

                    <Collapse in={showAdvanced}>
                        <Box sx={{
                            padding: '20px',
                            marginBottom: '12px',
                            border: '1px solid #eee',
                            borderRadius: '5px',
                            backgroundColor: '#fafafa'
                        }}>
                            {/* Scaling Mode */}
                            <Box sx={{ display: 'flex', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '20px' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Typography sx={{ color: '#666', marginRight: '15px', whiteSpace: 'nowrap' }}>{texts.inferScalingMode}</Typography>
                                    <RadioGroup
                                        row
                                        aria-labelledby="scaling-mode-group-label"
                                        name="scaling-mode-group"
                                        value={scalingMode}
                                        onChange={(e) => setScalingMode(e.target.value)}
                                    >
                                        <FormControlLabel value="manual" control={<Radio size="small" />} label={<Typography>{texts.inferManualScale}</Typography>} />
                                        <FormControlLabel value="target" control={<Radio size="small" />} label={<Typography>{texts.inferTargetResolution}</Typography>} />
                                    </RadioGroup>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <Typography sx={{ color: '#666' }}>{texts.inferSkipAlpha}</Typography>
                                    <Checkbox size="small" onChange={(event) => { setIsSkipAlpha(event.target.checked) }} checked={isSkipAlpha} />
                                </Box>
                            </Box>

                            {/* Mode Specific Controls */}
                            {scalingMode === 'manual' ? (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '30px', marginBottom: '15px' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', flex: '1 1 300px' }}>
                                        <Typography sx={{ color: '#666', marginRight: '15px', whiteSpace: 'nowrap' }}>{texts.inferScale}</Typography>
                                        <Slider disabled={getIsDisableTileAndScaleSetting()} size='small' aria-label="Small" defaultValue={4}
                                            valueLabelDisplay="auto" step={1} min={1} max={16} color='lightBlue'
                                            onChange={(event, newValue) => { setScale(newValue) }}
                                            value={scale}
                                            sx={{ flexGrow: 1, marginRight: '15px' }}
                                        />
                                        <Typography sx={{ width: '40px' }}>{scale}</Typography>
                                    </Box>

                                    <Box sx={{ display: 'flex', alignItems: 'center', flex: '1 1 300px' }}>
                                        <Typography sx={{ color: '#666', marginRight: '10px', whiteSpace: 'nowrap' }}>{texts.inferResizeTo}</Typography>
                                        <Autocomplete
                                            disablePortal
                                            freeSolo
                                            id="resizeTo"
                                            options={['1920x1080', '1280x720', '1/2']}
                                            fullWidth
                                            onInputChange={(event, value, reason) => { setResizeTo(value) }}
                                            onChange={(event, value) => { setResizeTo(value) }}
                                            renderInput={(params) => <TextField {...params} variant='standard' />}
                                            value={resizeTo || ''}
                                        />
                                    </Box>
                                </Box>
                            ) : (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '30px', marginBottom: '15px' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', flex: '1 1 300px' }}>
                                        <Typography sx={{ color: '#666', marginRight: '10px', whiteSpace: 'nowrap' }}>{texts.inferTargetSize}</Typography>
                                        <Autocomplete
                                            disablePortal
                                            freeSolo
                                            id="targetSize"
                                            options={['1920x1080', '1280x720', '3840x2160']}
                                            fullWidth
                                            onInputChange={(event, value, reason) => { setTatgetSize(value) }}
                                            onChange={(event, value) => { setTatgetSize(value) }}
                                            renderInput={(params) => <TextField {...params} variant='standard' />}
                                            value={targetSize || ''}
                                        />
                                    </Box>
                                </Box>
                            )}

                            {/* Tile Size & GPU */}
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center', marginBottom: '15px' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', flex: '1 1 300px' }}>
                                    <Typography sx={{ color: '#666', marginRight: '15px', whiteSpace: 'nowrap' }}>{texts.inferTileSize}</Typography>
                                    <Slider disabled={getIsDisableTileAndScaleSetting()} size='small' aria-label="Small" defaultValue={64}
                                        valueLabelDisplay="auto" step={64} min={64} max={640} color='lightBlue'
                                        onChange={(event, newValue) => { setTileSize(newValue) }}
                                        value={tileSize}
                                        sx={{ flexGrow: 1, marginRight: '15px' }}
                                    />
                                    <Typography sx={{ width: '40px' }}>{tileSize}</Typography>
                                </Box>

                                <Box sx={{ display: 'flex', alignItems: 'center', flex: '1 1 250px' }}>
                                    <Typography sx={{ color: '#666', marginRight: '10px', whiteSpace: 'nowrap' }}>GPU:</Typography>
                                    <Autocomplete
                                        disablePortal
                                        freeSolo
                                        id="gpuId"
                                        options={gpuOptions}
                                        fullWidth
                                        onInputChange={(event, value, reason) => { setGPUID(value) }}
                                        onChange={(event, value) => { setGPUID(value) }}
                                        renderInput={(params) => <TextField {...params} variant='standard' />}
                                        value={String(GPUID)}
                                    />
                                </Box>
                            </Box>

                        </Box>
                    </Collapse>

                    {/* Progress Bar */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <Typography sx={{ margin: '15px 0px' }}>{texts.inferProgress}</Typography>
                        <LinearProgress variant="determinate" color='lightGreen' value={progress} sx={{ flexGrow: 1, top: '2px', height: '2px', margin: '0px 10px' }} />
                        <ProgressTextDisplay
                            singleProgressText={singleProgressText}
                            totalProgressText={totalProgressText}
                            isBatchProcess={isBatchProcess}
                        ></ProgressTextDisplay>
                    </Box>

                    {/* Start Button */}
                    <Box sx={{ display: 'flex', justifyContent: 'center', marginTop: '12px', marginBottom: '8px' }}>
                        <Button variant="outlined" color='lightPink'
                            sx={{ width: '100%', padding: '10px' }}
                            loading={infering}
                            startIcon={<></>}
                            loadingPosition="start"
                            onClick={() => {
                                handleAlertClose();
                                setInfering(true);
                                runProcess(modelName, tileSize, scale, isSkipAlpha, resizeTo, inputType, inputImage, outputPath, GPUID, scalingMode, targetSize)
                            }}
                        >{texts.inferStartButton}</Button>
                    </Box>

                    {stateAlert}
                </div>
            </div>
        </div>
    );
}

export default InferenceUI;