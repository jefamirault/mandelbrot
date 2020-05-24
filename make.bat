@echo off
sass style.sass style.css
haml view.haml view.html
erb script.js.erb > script.js
