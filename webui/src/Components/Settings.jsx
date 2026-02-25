import './Settings.css'
import TextField from '@mui/material/TextField';
import { Typography } from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Button from '@mui/material/Button';
import { useState, useRef, useEffect } from 'react';

function Settings({ langSetter, webDevMode, language, alwaysShowAdvanced, setAlwaysShowAdvanced, rememberOptions, setRememberOptions, defaultOutputPath, setDefaultOutputPath, workflowKeepModels, setWorkflowKeepModels, texts }) {
    const languageOptions = ['English', '简体中文'];
    const [customFilenameFormat, setCustomFilenameFormat] = useState('{filestem}_MoeSR_x{scale}_{model_name}.png');
    const [localLanguage, setLocalLanguage] = useState(language);
    const [localAlwaysShowAdvanced, setLocalAlwaysShowAdvanced] = useState(alwaysShowAdvanced);
    const [localRememberOptions, setLocalRememberOptions] = useState(rememberOptions);
    const [localDefaultOutputPath, setLocalDefaultOutputPath] = useState(defaultOutputPath);
    const [localWorkflowKeepModels, setLocalWorkflowKeepModels] = useState(workflowKeepModels);
    const [filenameError, setFilenameError] = useState('');
    const filenameInputRef = useRef(null);

    // Illegal characters for Windows filenames
    const illegalChars = /[\\/:*?"<>|]/;

    // Load settings on mount
    useEffect(() => {
        if (!webDevMode) {
            window.eel.py_get_settings()().then((settings) => {
                if (settings.customFilenameFormat) {
                    setCustomFilenameFormat(settings.customFilenameFormat);
                }
            });
        }
    }, [webDevMode]);

    // Sync props to local state
    useEffect(() => {
        setLocalLanguage(language);
    }, [language]);

    useEffect(() => {
        setLocalAlwaysShowAdvanced(alwaysShowAdvanced);
    }, [alwaysShowAdvanced]);

    useEffect(() => {
        setLocalRememberOptions(rememberOptions);
    }, [rememberOptions]);

    useEffect(() => {
        setLocalDefaultOutputPath(defaultOutputPath);
    }, [defaultOutputPath]);

    useEffect(() => {
        setLocalWorkflowKeepModels(workflowKeepModels);
    }, [workflowKeepModels]);

    // Validate filename format
    const validateFilename = (filename) => {
        // Remove placeholders before checking
        const withoutPlaceholders = filename
            .replace(/{filestem}/g, '')
            .replace(/{scale}/g, '')
            .replace(/{model_name}/g, '');
        
        if (illegalChars.test(withoutPlaceholders)) {
            setFilenameError(texts.settingsFilenameError);
            return false;
        }
        setFilenameError('');
        return true;
    };

    // Save all settings
    const handleSaveSettings = () => {
        if (!validateFilename(customFilenameFormat)) {
            return;
        }

        // Apply language change
        if (localLanguage !== language) {
            langSetter(localLanguage);
        }
        
        // Apply alwaysShowAdvanced change
        if (localAlwaysShowAdvanced !== alwaysShowAdvanced) {
            setAlwaysShowAdvanced(localAlwaysShowAdvanced);
        }

        // Apply rememberOptions change
        if (localRememberOptions !== rememberOptions) {
            setRememberOptions(localRememberOptions);
        }

        // Apply defaultOutputPath change
        if (localDefaultOutputPath !== defaultOutputPath) {
            setDefaultOutputPath(localDefaultOutputPath);
        }

        // Apply workflowKeepModels change
        if (localWorkflowKeepModels !== workflowKeepModels) {
            setWorkflowKeepModels(localWorkflowKeepModels);
        }

        let settings = {
            'language': localLanguage,
            'alwaysShowAdvanced': localAlwaysShowAdvanced,
            'customFilenameFormat': customFilenameFormat,
            'rememberOptions': localRememberOptions,
            'defaultOutputPath': localDefaultOutputPath,
            'workflowKeepModels': localWorkflowKeepModels,
        }
        if (webDevMode) {
            console.log(settings)
        }
        else {
            window.eel.py_save_settings(settings)
        }
    };

    const insertPlaceholder = (placeholder) => {
        const input = filenameInputRef.current?.querySelector('input');
        if (input) {
            const start = input.selectionStart;
            const end = input.selectionEnd;
            const newValue = customFilenameFormat.substring(0, start) + placeholder + customFilenameFormat.substring(end);
            setCustomFilenameFormat(newValue);
            validateFilename(newValue);
            setTimeout(() => {
                input.focus();
                input.setSelectionRange(start + placeholder.length, start + placeholder.length);
            }, 0);
        }
    };

    const resetToDefault = () => {
        const defaultFormat = '{filestem}_MoeSR_x{scale}_{model_name}.png';
        setCustomFilenameFormat(defaultFormat);
        setFilenameError('');
    };

    const setSameAsInput = () => {
        const sameAsInputFormat = '{filestem}.png';
        setCustomFilenameFormat(sameAsInputFormat);
        setFilenameError('');
    };

    return (
        <div className="SettingsContainer">
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '20px'
                }}>
                <Typography>Language:</Typography>
                <Autocomplete
                    disablePortal
                    id="language"
                    options={languageOptions}
                    sx={{ width: '30%', marginLeft: '10px' }}
                    onChange={(event, newValue) => {
                        setLocalLanguage(newValue);
                    }}
                    value={localLanguage}
                    renderInput={(params) => <TextField {...params} variant='standard' />}
                />
            </Box>

            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '10px'
                }}>
                <Typography sx={{ marginRight: '10px', minWidth: '150px' }}>{texts.settingsCustomFilename}</Typography>
                <TextField
                    ref={filenameInputRef}
                    variant='standard'
                    size='small'
                    value={customFilenameFormat}
                    onChange={(event) => {
                        setCustomFilenameFormat(event.target.value);
                        validateFilename(event.target.value);
                    }}
                    error={!!filenameError}
                    helperText={filenameError}
                    sx={{ flex: 1, maxWidth: '500px' }}
                />
            </Box>

            <Box sx={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <Button 
                    variant="outlined" 
                    size="small"
                    onClick={() => insertPlaceholder('{filestem}')}
                >
                    {texts.settingsInsertFilestem}
                </Button>
                <Button 
                    variant="outlined" 
                    size="small"
                    onClick={() => insertPlaceholder('{scale}')}
                >
                    {texts.settingsInsertScale}
                </Button>
                <Button 
                    variant="outlined" 
                    size="small"
                    onClick={() => insertPlaceholder('{model_name}')}
                >
                    {texts.settingsInsertModelName}
                </Button>
                <Button 
                    variant="outlined" 
                    size="small"
                    onClick={resetToDefault}
                >
                    {texts.settingsResetDefault}
                </Button>
                <Button 
                    variant="outlined" 
                    size="small"
                    onClick={setSameAsInput}
                >
                    {texts.settingsSameAsInput}
                </Button>
            </Box>

            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '20px'
                }}>
                <FormControlLabel control={
                    <Switch
                        checked={localAlwaysShowAdvanced}
                        onChange={(event) => {
                            setLocalAlwaysShowAdvanced(event.target.checked);
                        }}
                    />
                } label={texts.settingsAlwaysShowAdvanced} />
            </Box>

            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '20px'
                }}>
                <FormControlLabel control={
                    <Switch
                        checked={localRememberOptions}
                        onChange={(event) => {
                            setLocalRememberOptions(event.target.checked);
                        }}
                    />
                } label={texts.settingsRememberOptions} />
            </Box>

            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '20px'
                }}>
                <FormControlLabel control={
                    <Switch
                        checked={localDefaultOutputPath}
                        onChange={(event) => {
                            setLocalDefaultOutputPath(event.target.checked);
                        }}
                    />
                } label={texts.settingsDefaultOutputPath} />
            </Box>

            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '20px'
                }}>
                <FormControlLabel control={
                    <Switch
                        checked={localWorkflowKeepModels}
                        onChange={(event) => {
                            setLocalWorkflowKeepModels(event.target.checked);
                        }}
                    />
                } label={texts.settingsWorkflowKeepModels} />
            </Box>

            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    marginTop: '20px'
                }}>
                <Button 
                    variant="outlined" 
                    color="lightPink"
                    onClick={handleSaveSettings}
                    disabled={!!filenameError}
                >
                    {texts.settingsSaveButton}
                </Button>
            </Box>

        </div>);
}

export default Settings;
