function getGameTime() {
  return (new Date()).getTime();
}

function formatFloat(x, decimals) {
  return x.toFixed(decimals);
}

function main() {
  data.BaseSize = 50;
  data.BaseOffset = 300;
  data.xBound = data.BaseOffset;
  data.yBound = 100;
  data.UnitType = {
    BASE: 0,
    UNIT: 1,
  };
  data.units = [];

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

  setupHandlers();

  requestAnimationFrame(update);

  data.startTime = getGameTime();
  tick();
}

function addUnit(spec) {
  var unit = {};
  unit.color = spec.team == 0 ? 0xFF0000 : 0x0000FF;
  var sphere = getSphere(spec.size, unit.color);
  data.scene.add(sphere);
  unit.three = sphere;
  unit.spec = spec;
  unit.tick = function() {
    var move = function() {
      var speed = spec.team == 0 ? spec.speed : -spec.speed;
      if (spec.team == 0) {
        if (unit.three.position.x + speed <= data.xBound) {
          unit.three.position.x += speed;
        }
      } else {
        if (unit.three.position.x + speed >= -data.xBound) {
          unit.three.position.x += speed;
        }
      }
    };
    var targetsInRange = function() {
      // TODO: optimize
      var targets = [];
      for (var i = 0; i < data.units.length; i++) {
        var unit2 = data.units[i];
        if (unit === unit2) continue;
        if (unit.team === unit2.team) continue;
        var dist = unit.three.position.distanceTo(unit2.three.position);
        if (dist < unit2.size + spec.range) {
          targets.push(unit2);
        }
      }
      return targets;
    };
    var attack = function(targets) {
      for (var i = 0; i < targets.length; i++) {
        var target = targets[i];
        target.setHealth(target.getHealth() - spec.damage);
        break;
      }
    };
    var targets = targetsInRange();
    if (targets.length > 0) {
      attack(targets);
    } else {
      move();
    }
  };
  return unit;
}

function send() {
  spec = {
    team: 0,
    size: 5,
    speed: 1.0,
    sight: 10,
    range: 50,
    damage: 0.01,
    health: 100,
    maxHealth: 100,
  };
  var unit = addUnit(spec);
  var offset = 10;
  unit.three.position.x = 
    spec.team == 0 ?
    data.base1.three.position.x + data.base1.spec.size + offset : 
    data.base2.three.position.x - data.base2.spec.size - offset;
  unit.three.position.y = (Math.random() * 2.0 - 1.0) * data.yBound;
  data.units.push(unit);
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
  var baseOffset = data.BaseOffset;
  var baseSpec = {
    team: 0,
    size: data.BaseSize,
    speed: 0,
    sight: 10,
    range: 5,
    damage: 1.0,
    health: 100,
    maxHealth: 100,
    type: data.UnitType.BASE,
  };
  var baseSpec1 = $.extend({}, baseSpec);
  var baseSpec2 = $.extend({}, baseSpec, {
    team: 1
  });

  var unit = addUnit(baseSpec1);
  unit.three.position.x = -baseOffset;
  data.units.push(unit);
  data.base1 = unit;
 
  var health = addBaseHealth();
  var healthWidth = 300;
  health.$progress.offset({
    top: 100,
    left: 80
  });
  health.$progress.width(healthWidth);
  data.base1.health = health;

  var unit = addUnit(baseSpec2);
  unit.three.position.x = baseOffset;
  data.units.push(unit);
  data.base2 = unit;

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
    progress.health = health;
  }
  progress.getHealth = function() {
    return progress.health;
  }
  progress.$progress = $progress;
  progress.setHealth(1.0);

  return progress;
}

function tick() {
  elapsed = getGameTime() - data.startTime;

  for (var i = 0; i < data.units.length; i++) {
    var unit = data.units[i];
    unit.tick();
  }

  //data.sphere.position.x = Math.sin(elapsed * 0.01) * 50.0;
  //data.sphere.position.y = Math.cos(elapsed * 0.01) * 50.0;

  // data.base1.health.setHealth((Math.sin(elapsed * 0.001) + 1.0) / 2.0);

  setTimeout(tick, 1);
}

function update() {
  data.renderer.render(data.scene, data.camera);
  requestAnimationFrame(update);
}

var data = {};
$(main);
