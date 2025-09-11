!include "MUI2.nsh"
!include "FileFunc.nsh"

!macro preInit
  SetRegView 64
  ; Force user-local installation directory
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\${PRODUCT_NAME}"
  SetShellVarContext current
!macroend

!macro customInit
  ; Kill any running instances before installation
  DetailPrint "Checking for running Pairkiller processes..."
  nsExec::ExecToLog 'taskkill /F /IM "Pairkiller.exe" /T'
  Sleep 2000
!macroend

!macro customInstall
  SetShellVarContext current
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\${PRODUCT_NAME}"
  
  DetailPrint "=== Pairkiller Installation Started ==="
  DetailPrint "Installing to: $INSTDIR"
  
  ; Clean up any previous installations first
  Call CleanupPreviousInstallations
  
  ; Ensure installation directory exists and is clean
  RMDir /r "$INSTDIR"
  Sleep 1000
  CreateDirectory "$INSTDIR"
  
  ; Clean registry before installing
  DeleteRegKey HKCU "Software\Pairkiller"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Pairkiller"
  
  ; Create fresh registry entries
  WriteRegStr HKCU "Software\Pairkiller" "InstallPath" "$INSTDIR"
  WriteRegStr HKCU "Software\Pairkiller" "Version" "${VERSION}"
  WriteRegStr HKCU "Software\Pairkiller" "InstallDate" "$$(Date)"
  
  ; Set up auto-start
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Pairkiller" '"$INSTDIR\${PRODUCT_NAME}.exe" --startup'
  
  ; Clean up old shortcuts first
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
  Delete "$DESKTOP\Pairkiller.lnk"
  RMDir /r "$SMPROGRAMS\${PRODUCT_NAME}"
  RMDir /r "$SMPROGRAMS\Pairkiller"
  
  ; Create fresh shortcuts
  CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
  CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk" "$INSTDIR\${PRODUCT_NAME}.exe" "" "$INSTDIR\${PRODUCT_NAME}.exe" 0
  CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}\Uninstall ${PRODUCT_NAME}.lnk" "$INSTDIR\Uninstall ${PRODUCT_NAME}.exe"
  
  ; Create Desktop shortcut if requested
  ${if} $Desktop == 1
    CreateShortcut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\${PRODUCT_NAME}.exe" "" "$INSTDIR\${PRODUCT_NAME}.exe" 0
  ${endif}
  
  ; Verify installation
  IfFileExists "$INSTDIR\${PRODUCT_NAME}.exe" InstallSuccess InstallFailed
  
  InstallSuccess:
    DetailPrint "✓ Installation completed successfully!"
    DetailPrint "✓ Files installed to: $INSTDIR"
    DetailPrint "✓ Shortcuts created in Start Menu"
    DetailPrint "✓ Auto-start configured"
    Goto InstallEnd
    
  InstallFailed:
    DetailPrint "✗ Installation verification failed!"
    MessageBox MB_ICONSTOP "Installation failed. Please try again or contact support."
    
  InstallEnd:
!macroend

!macro customUnInstall
  DetailPrint "=== Pairkiller Uninstallation Started ==="
  
  ; Kill running processes
  nsExec::ExecToLog 'taskkill /F /IM "Pairkiller.exe" /T'
  Sleep 2000
  
  ; Remove from Windows startup
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Pairkiller"
  
  ; Remove registry entries
  DeleteRegKey HKCU "Software\Pairkiller"
  
  ; Remove shortcuts
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
  Delete "$DESKTOP\Pairkiller.lnk"
  RMDir /r "$SMPROGRAMS\${PRODUCT_NAME}"
  RMDir /r "$SMPROGRAMS\Pairkiller"
  
  DetailPrint "✓ Uninstallation completed successfully!"
!macroend

!macro customInstallMode
  StrCpy $installMode "CurrentUser"
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\${PRODUCT_NAME}"
  SetShellVarContext current
!macroend

; Function to clean up previous installations
Function CleanupPreviousInstallations
  DetailPrint "Cleaning up previous installations..."
  
  ; List of possible old installation locations
  Push "$LOCALAPPDATA\Programs\Pairkiller"
  Push "$APPDATA\Pairkiller"
  Push "$PROGRAMFILES\Pairkiller"
  Push "$PROGRAMFILES(X86)\Pairkiller"
  Push "$TEMP\Pairkiller"
  
  ; Clean each location
  Pop $R0
  IfFileExists "$R0\*.*" 0 +3
    DetailPrint "Removing old installation: $R0"
    RMDir /r "$R0"
  
  Pop $R0
  IfFileExists "$R0\*.*" 0 +3
    DetailPrint "Removing old installation: $R0"
    RMDir /r "$R0"
    
  Pop $R0
  IfFileExists "$R0\*.*" 0 +3
    DetailPrint "Removing old installation: $R0"
    RMDir /r "$R0"
    
  Pop $R0
  IfFileExists "$R0\*.*" 0 +3
    DetailPrint "Removing old installation: $R0"
    RMDir /r "$R0"
    
  Pop $R0
  IfFileExists "$R0\*.*" 0 +3
    DetailPrint "Removing old installation: $R0"
    RMDir /r "$R0"
    
  ; Clean up orphaned registry entries
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Pairkiller"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Pairkiller"
  
  DetailPrint "✓ Cleanup completed"
FunctionEnd



