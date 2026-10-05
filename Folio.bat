@echo off
rem Starts Folio from the source folder. Drop a PDF onto this file to open it.
cd /d "%~dp0"
call npm start -- %*
