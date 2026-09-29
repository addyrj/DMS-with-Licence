Start-Service mosquitto
If not installed → install Mosquitto on Windows:

Download from: https://mosquitto.org/download/ → Windows installer
Install it
Find the config file at C:\Program Files\mosquitto\mosquitto.conf
Edit it — add these lines at the bottom:



listener 1883
protocol mqtt
allow_anonymous true

listener 9001
protocol websockets
allow_anonymous true

cd "C:\Program Files\mosquitto"
.\mosquitto.exe -c mosquitto.conf -v

Keep that window open. Then test:

Test-NetConnection -ComputerName 192.168.1.103 -Port 9001