; Asks at install time whether Folio should open PDF files, then registers it for the current user.
!macro customInstall
  MessageBox MB_YESNO|MB_ICONQUESTION "Open PDF files with Folio by default?" /SD IDNO IDNO skipAssoc
    WriteRegStr HKCU "Software\Classes\Folio.pdf" "" "PDF document"
    WriteRegStr HKCU "Software\Classes\Folio.pdf\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
    WriteRegStr HKCU "Software\Classes\Folio.pdf\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
    WriteRegStr HKCU "Software\Classes\.pdf\OpenWithProgids" "Folio.pdf" ""
    System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
  skipAssoc:
!macroend

!macro customUnInstall
  DeleteRegKey HKCU "Software\Classes\Folio.pdf"
  DeleteRegValue HKCU "Software\Classes\.pdf\OpenWithProgids" "Folio.pdf"
!macroend
