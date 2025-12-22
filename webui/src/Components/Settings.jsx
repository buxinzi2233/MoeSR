import './Settings.css'
import TextField from '@mui/material/TextField';
import { Typography } from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';

function Settings({ langSetter, webDevMode, language, alwaysShowAdvanced, setAlwaysShowAdvanced, texts }) {
    const languageOptions = ['English', '简体中文'];
    // 未来更多设置将改为保存按钮触发此函数
    function handleSettingsChange(webDevMode, language = null, alwaysShowAdvanced = false) {
        let settings = { 'language': language, 'alwaysShowAdvanced': alwaysShowAdvanced }
        if (webDevMode) {
            console.log(settings)
        }
        else {
            window.eel.py_save_settings(settings)
        }
    }
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
                        langSetter(newValue);
                        handleSettingsChange(webDevMode, newValue, alwaysShowAdvanced);
                    }}
                    value={language}
                    renderInput={(params) => <TextField {...params} variant='standard' />}
                />
            </Box>
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center'
                }}>
                <FormControlLabel control={
                    <Switch
                        checked={alwaysShowAdvanced}
                        onChange={(event) => {
                            setAlwaysShowAdvanced(event.target.checked);
                            handleSettingsChange(webDevMode, language, event.target.checked);
                        }}
                    />
                } label={texts.settingsAlwaysShowAdvanced} />
            </Box>

        </div>);
}

export default Settings;