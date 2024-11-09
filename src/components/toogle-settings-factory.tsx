export const toggleSettingFactory = (settingsObject, setSettingsObject) => {
    return function toggleSetting(setting: string) {
        if (typeof settingsObject[setting] == "boolean") {
            setSettingsObject({ ...settingsObject, [setting]: !settingsObject[setting] })
        } else {
            console.log("Error: Could not toggle ", setting)
        }
    }
}