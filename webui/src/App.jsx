import './App.css';
import Navbar from './Components/Navbar';
import InferenceUI from './Components/InferenceUI';
import WorkflowUI from './Components/WorkflowUI';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import BackGround from './Components/Background';
import { useState, useEffect } from 'react';
import Help from './Components/Help';
import About from './Components/About';
import Settings from './Components/Settings';
import translations from './Language';
var webDevMode = false;
const theme = createTheme({
  typography: {
    fontFamily: 'NotoSerifSC, Arial',
    fontSize: 13.5,
  },
  palette: {
    inferui: {
      main: '#666'
    },
    lightBlue: {
      main: '#7ecef4',
      light: '#98d6f4',
      dark: '#67c6f3'
    },
    lightPink: {
      main: '#ea68a2'
    },
    lightGreen: {
      main: '#a2db86'
    }
  }
  // components: {
  //   MuiCssBaseline: {
  //     styleOverrides: `
  //       @font-face {
  //         font-family: "NotoSerifSC";
  //         src: url('../public/NotoSerifSC-Regular-subset.woff2') format('woff2');
  //       }
  //     `,
  //   },
  // },
});
async function getSettings(webDevMode) {
  if (webDevMode) {
      let dummyData = {'language':'English', 'alwaysShowAdvanced': false}
      return dummyData
  }
  else {
      return await window.eel.py_get_settings()()
  }
}
function App() {
  const [navigation, setNavigation] = useState('real-esrgan');
  const [lang,SetLang] = useState('English');
  const [alwaysShowAdvanced, setAlwaysShowAdvanced] = useState(false);
  const langMap = {'English':'en','简体中文':'zh'};
  useEffect(() => {
    getSettings(webDevMode).then(result => {
      SetLang(result['language']);
      if (result['alwaysShowAdvanced'] !== undefined) {
        setAlwaysShowAdvanced(result['alwaysShowAdvanced']);
      }
    })
    console.log('Effect run ' + lang)
  }, []);// eslint-disable-line
  if (!(lang in langMap)){
    SetLang('English')
  }
  const texts = translations[langMap[lang]]
  const availableAlgos = ["real-esrgan","real-hatgan","moe-ir"]
  var content;
  // real-esrgan or real-hatgan
  if (availableAlgos.includes(navigation)) {
    content = <InferenceUI algoName={navigation} webDevMode={webDevMode} texts={texts} alwaysShowAdvanced={alwaysShowAdvanced}></InferenceUI>
  }
  else if (navigation === 'settings') {
    content = <Settings langSetter={SetLang} webDevMode={webDevMode} language={lang} alwaysShowAdvanced={alwaysShowAdvanced} setAlwaysShowAdvanced={setAlwaysShowAdvanced} texts={texts}></Settings>
  }
  else if (navigation === 'workflow') {
    content = <WorkflowUI webDevMode={webDevMode} texts={texts}></WorkflowUI>
  }
  else if (navigation === 'help') {
    content = <Help language={lang}></Help>
  }
  else if (navigation === 'about') {
    content = <About texts={texts}></About>
  }
  console.log(navigation)
  return (
    <div className="App">
      <ThemeProvider theme={theme}>
        <BackGround></BackGround>
        <Navbar setNavigation={setNavigation}></Navbar>
        {content}
        <div className="Version">
            MoeSR Release 1.1.0
        </div>
      </ThemeProvider>
      
    </div>

  );
}

export default App;
