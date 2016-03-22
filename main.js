function getGameTime() {
  return (new Date()).getTime();
}

function formatFloat(x, decimals) {
  return x.toFixed(decimals);
}

function main() {
  // set the scene size
  var WIDTH = window.innerWidth,
    HEIGHT = 600;

  // set some camera attributes
  var VIEW_ANGLE = 45,
    ASPECT = WIDTH / HEIGHT,
    NEAR = 0.1,
    FAR = 10000;

  // get the DOM element to attach to
  // - assume we've got jQuery to hand
  var $container = $('#container');

  // create a WebGL renderer, camera
  // and a scene
  var renderer = new THREE.WebGLRenderer();
  data.renderer = renderer;
  var camera =
    new THREE.PerspectiveCamera(
      VIEW_ANGLE,
      ASPECT,
      NEAR,
      FAR);
  data.camera = camera;

  var scene = new THREE.Scene();
  data.scene = scene;

  // add the camera to the scene
  scene.add(camera);

  // the camera starts at 0,0,0
  // so pull it back
  camera.position.z = 300;

  // start the renderer
  renderer.setSize(WIDTH, HEIGHT);

  // attach the render-supplied DOM element
  $container.append(renderer.domElement);

  addLights();

  addBases();
  addUnits();

  setupHandlers();

  requestAnimationFrame(update);

  data.startTime = getGameTime();
  tick();
}

function send() {
  console.log("send");
}

function setupHandlers() {
  var $send = $('#send');
  $send.click(send);
}

function addLights() {
  // create a point light
  var pointLight =
    new THREE.PointLight(0xFFFFFF);

  // set its position
  pointLight.position.x = 10;
  pointLight.position.y = 50;
  pointLight.position.z = 130;

  // add to the scene
  data.scene.add(pointLight);
}

function getSphere(radius, color) {
  // set up the sphere vars
  var radius = radius,
      segments = 16,
      rings = 16;

  // create the sphere's material
  var sphereMaterial =
    new THREE.MeshLambertMaterial(
      {
        color: color
      });

  // create a new mesh with
  // sphere geometry - we will cover
  // the sphereMaterial next!
  var sphere = new THREE.Mesh(

    new THREE.SphereGeometry(
      radius,
      segments,
      rings),

    sphereMaterial);

  return sphere; 
}

function addBases() {
  var baseSize = 50;
  var baseOffset = 300;

  var base1 = getSphere(baseSize, 0xFF0000);
  base1.position.x = -baseOffset;
  data.base1 = {};
  data.base1.three = base1;
  data.scene.add(base1);
 
  var health = addBaseHealth();
  var healthWidth = 300;
  health.$progress.offset({
    top: 100,
    left: 80
  });
  health.$progress.width(healthWidth);
  data.base1.health = health;

  var base2 = getSphere(baseSize, 0x0000FF);
  base2.position.x = baseOffset;
  data.base2 = {};
  data.base2.three = base2;
  data.scene.add(base2);

  var health = addBaseHealth();
  health.$progress.offset({
    top: 100,
    left: window.innerWidth - 80 - healthWidth
  });
  health.$progress.width(healthWidth);
  data.base2.health = health;
}

function addBaseHealth() {
  progress = {};

  $progress = $("<div class='myProgress'/>");
  $bar = $("<div class='myBar'/>");
  $text = $("<span/>");
  $progress.append($bar);
  $bar.append($text);
  $("body").append($progress);

  progress.setHealth = function(health) {
    $bar.width(health * 100 + '%');
    $text.html(formatFloat(health * 100, 0) + '%');
  }
  progress.$progress = $progress;
  progress.setHealth(1.0);

  return progress;
}

function addUnits() {
  // set up the sphere vars
  var radius = 5,
      segments = 16,
      rings = 16;

  // create the sphere's material
  var sphereMaterial =
    new THREE.MeshLambertMaterial(
      {
        color: 0xCC0000
      });

  // create a new mesh with
  // sphere geometry - we will cover
  // the sphereMaterial next!
  var sphere = new THREE.Mesh(

    new THREE.SphereGeometry(
      radius,
      segments,
      rings),

    sphereMaterial);

  data.sphere = sphere;

  // add the sphere to the scene
  data.scene.add(sphere);
}

function tick() {
  elapsed = getGameTime() - data.startTime;
  data.sphere.position.x = Math.sin(elapsed * 0.01) * 50.0;
  data.sphere.position.y = Math.cos(elapsed * 0.01) * 50.0;

  // data.base1.health.setHealth((Math.sin(elapsed * 0.001) + 1.0) / 2.0);

  setTimeout(tick, 1);
}

function update() {
  data.renderer.render(data.scene, data.camera);
  requestAnimationFrame(update);
}

var data = {};
$(main);
