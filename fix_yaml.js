const fs = require('fs');
const yaml = \
ame: Build Android APK
on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    
    - name: Use Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        
    - name: Install Dependencies
      run: npm install
      
    - name: Build Web App
      run: npm run build
      
    - name: Sync Capacitor
      run: npx cap sync android
      
    - name: Set up JDK 17
      uses: actions/setup-java@v4
      with:
        java-version: '17'
        distribution: 'temurin'
        
    - name: Build APK
      run: |
        cd android
        chmod +x gradlew
        ./gradlew assembleDebug
        
    - name: Upload APK
      uses: actions/upload-artifact@v4
      with:
        name: ApexChess-Android-App
        path: android/app/build/outputs/apk/debug/app-debug.apk\;
fs.writeFileSync('.github/workflows/android-build.yml', yaml, 'utf8');
