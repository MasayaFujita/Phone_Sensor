var lat = null, lng, alt, accLatlng, accAlt, heading, speed;                         //位置情報変数
var alpha, beta, gamma;                                                       //ジャイロセンサー変数
var ac = {}, acg = {}, rot = {};                                                             //モーションセンサー
var battery, battery_level, battery_discharging;                                       //バッテリー
var client;                                                                   // MQTTのクライアントです
var deviceid;
var devicetype = "MyDevice";
var pubTopic = 'iot-2/evt/status/fmt/json';
var phoneData = {};
phoneData.d = {};

$(function () {
// deviceIdの取得
  getDeviceId();
  console.log(deviceid);
// MQTT Connect
  MQTT_Connect();
//　位置情報取得
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(GetLocation, GetLocationError);      //現在地を取得
  } else {
    alert("お使いの端末は、GeoLacation APIに対応していません。");                           //アラート表示
  }
// ジャイロセンサー
  if (window.DeviceOrientationEvent) {
    window.addEventListener("deviceorientation", deviceOrientation);
  }
// モーションセンサー
  if (window.DeviceMotionEvent) {
    window.addEventListener("devicemotion", deviceMotion);
  }
// バッテリー
  battery = navigator.battery || navigator.mozBattery || navigator.webkitBattery;
  if (battery) {
    battery.addEventListener("levelchange", updateBatteryStatus);
  } else {
    battery_level         = "未対応";
    battery_discharging   = "未対応";
  }
});
// デバイスIDの取得
function getDeviceId() {
  var did = null;
  var i;
  cookies = document.cookie.split("; ");
  for (i = 0; i < cookies.length; i++) {
    str = cookies[i].split("=");
    if (unescape(str[0]) === "deviceid") {
      did = unescape(unescape(str[1]));
    }
  }
  if (did !== null) {
    deviceid = did;
  } else {
    deviceid = generateDeviceId();
    //console.log( "deviceid = " + deviceid );
  }
  $('#deviceid').html("DeviceID: " + deviceid);
  document.title = deviceid;
}

function generateDeviceId() {
  var did = "";
  var hx = "0123456789abcdef";
  var i, c, n;
  for (i = 0; i < 12; i++) {
    n = Math.floor(Math.random() * 16);
    if (n === 16) {n = 15; }
    c = hx.charAt(n);
    did += c;
  }
  var str = "deviceid=" + did;
  document.cookie = str;
  return did;
}
// 位置情報
function GetLocation(position) {
  lat         = position.coords.latitude;
  lng         = position.coords.longitude;
  accLatlng   = position.coords.accuracy;
  alt         = position.coords.altitude;
  accAlt      = position.coords.altitudeAccuracy;
  heading     = position.coords.heading;     //0=北,90=東,180=南,270=西
  speed       = position.coords.speed;
  RenderHtml();
  MQTT_Publish();
}
function GetLocationError(error) {
  alert("Geolocation Error");
}
// ジャイロセンサー
function deviceOrientation(event) { 
  alpha     = event.alpha;
  beta      = event.beta;   // tiltFB
  gamma     = event.gamma;  // tiltLR

  RenderHtml();
  MQTT_Publish();
}
// モーションセンサー
function deviceMotion(event) {
  event.preventDefault();
  ac        = event.acceleration;
  acg       = event.accelerationIncludingGravity;
  rot       = event.rotationRate;
  RenderHtml();
  MQTT_Publish();
}
// バッテリー残量
function updateBatteryStatus(event) {
  battery_level = battery.level;
  battery_discharging = battery.discharging;
  RenderHtml();
  MQTT_Publish();
}

function RenderHtml() {
// 位置情報
  if (lat !== null) { $('#lat').html(lat); }
  if (lng !== null) { $('#lng').html(lng); }
  if (accLatlng !== null) { $('#accLatlng').html(accLatlng); }
  if (alt !== null) { $('#alt').html(alt); }
  if (accAlt !== null) { $('#accAlt').html(accAlt); }
  if (heading !== null) { $('#heading').html(heading); }
  if (speed !== null) { $('#speed').html(speed); }
//　ジャイロセンサー
  if (alpha !== null) { $('#alpha').html(alpha); }
  if (beta !== null) { $('#beta').html(beta); }
  if (gamma !== null) { $('#gamma').html(gamma); }
// モーションセンサー
  if (ac !== null) {
    $('#ac_x').html(ac.x);
    $('#ac_y').html(ac.y);
    $('#ac_z').html(ac.z);
  }
  if (acg !== null) {
    $('#acg_x').html(acg.x);
    $('#acg_y').html(acg.y);
    $('#acg_z').html(acg.z);
  }
  if (rot !== null) {
    $('#rot_alpha').html(rot.alpha);
    $('#rot_beta').html(rot.beta);
    $('#rot_gamma').html(rot.gamma);
  }
  // バッテリー
  if (battery_level !== null) { $('#battery_level').html(battery_level); }
  if (battery_discharging !== null) { $('#battery_discharging').html(battery_discharging); }
}

function MQTT_Connect() {
  var clientId = "d:quickstart:" + devicetype + ":" + deviceid; // ClientIDを指定します。
    console.log("MQTT_Connect starts");
    connect();
  function connect() {
    var wsurl = "ws://quickstart.messaging.internetofthings.ibmcloud.com:1883/";
      // WebSocketURLとClientIDからMQTT Clientを作成します
    client = new Paho.MQTT.Client(wsurl, clientId);
      // connectします
    client.connect({onSuccess: onConnect, onFailure: failConnect});
    client.onConnectionLost = onConnectionLost;
  }
// 接続が失敗したら呼び出されます
  function failConnect(e) {
    console.log("connect failed");
    console.log(e);
  }
// 接続に成功したら呼び出されます
  function onConnect() {
    console.log("onConnect");
  }
  function onConnectionLost(response) {
    console.log("onConnectionLost");
    if (response.errorCode !== 0) {
      console.log("onConnectionLost:" + response.errorMessage);
    }
    clearInterval(msgInterval);
    client.connect({onSuccess: onConnect, onFailure: onConnectFailure});
  }
}
function MQTT_Publish() {
  if (deviceid != null){
    var d = {}; d.location = {}; d.ori = {}; d.battery = {};
    d.location.lat = lat;
    d.location.lng = lng;
    d.location.accLatlng = accLatlng;
    d.location.alt = alt;
    d.location.accAlt = accAlt;
    d.ori.alpha = alpha;
    d.ori.beta = beta;
    d.ori.gamma = gamma;
    d.ac = ac;
    d.acg = acg;
    d.rot = rot;
    d.battery.level = battery_level;
    d.battery.discharging = battery_discharging;

    if (d) {
      phoneData.d = d;
      phoneData.publish();
      console.log(d);
    }
  }
}

phoneData.toJson = function () {
  return JSON.stringify(this);
}

phoneData.publish = function () {
  var message = new Paho.MQTT.Message( phoneData.toJson() );
  message.destinationName = pubTopic;
  client.send(message);
}


