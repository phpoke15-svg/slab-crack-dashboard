const fs = require("fs")
const path = require("path")

const appJson = require("./app.json")
const expo = { ...appJson.expo }

const iosGoogleServices = "./GoogleService-Info.plist"
const androidGoogleServices = "./google-services.json"

if (expo.ios) {
  expo.ios = { ...expo.ios }
  if (!fs.existsSync(path.join(__dirname, iosGoogleServices))) {
    delete expo.ios.googleServicesFile
  }
}

if (expo.android) {
  expo.android = { ...expo.android }
  if (!fs.existsSync(path.join(__dirname, androidGoogleServices))) {
    delete expo.android.googleServicesFile
  }
}

/** @type {import('@expo/config').ExpoConfig} */
module.exports = {
  expo,
}
