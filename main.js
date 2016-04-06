function getGameTime() {
  return (new Date()).getTime();
}

function formatFloat(x, decimals) {
  return x.toFixed(decimals);
}

function worldToScreen(pos) {
  var vector = pos.clone().project(data.camera);

  vector.x = (vector.x + 1) / 2 * data.width;
  vector.y = -(vector.y - 1) / 2 * data.height;

  return new THREE.Vector2(vector.x, vector.y);
}

function checkTestEnvironment() {
  //return window && window.process && window.process.type;
  return window.shapewars_test !== undefined;
}

function checkTestServer() {
  return window.shapewars_test.server === true;
}

function main() {
  data.BaseSize = 50;
  data.BaseOffset = 250;
  data.xBound = data.BaseOffset;
  data.yBound = 100;
  data.UnitType = {
    BASE: 0,
    UNIT: 1,
  };
  data.units = [];

  // set the scene size
  var WIDTH = window.innerWidth,
    HEIGHT = 400;
  data.width = WIDTH;
  data.height = HEIGHT;

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

  // necessary for worldToScreen
  data.renderer.render(data.scene, data.camera);
  addBases();

  setupHandlers();

  setupPeer();

  requestAnimationFrame(update);

  data.startTime = getGameTime();
  tick();
}

function setupPeer() {
  var peer = new Peer({key: 'lwjd5qra8257b9'});
  data.peer = {};
  data.peer.isServer = true;
  data.peer.peer = peer;
  data.peer.idPromise = new Promise(function (resolve, reject) {
    peer.on('open', function(id) {
        resolve(id);
    });
  });

  data.peer.idPromise.then(function(id) {
    if (checkTestEnvironment()) {
      if (checkTestServer()) {
        $("#connectId").val(id);
        ipcRenderer.sendToHost("peerId", id);
      }
    } else {
      $("#connectId").val(id);
    }
  });
  data.peer.serverConnPromise = new Promise(function(resolve, reject) {
    data.peer.idPromise.then(function(id) {
      peer.on('connection', function(conn) {
        resolve(conn);
      });
    });
  });
}

function addUnit(spec, initial, shadow) {
  var unit = $.extend({}, initial);
  if (!shadow) {
    unit.health = spec.maxHealth;
  }
  unit.color = unit.team == 0 ? 0xFF0000 : 0x0000FF;
  var sphere = getSphere(spec.size, unit.color);
  data.scene.add(sphere);
  unit.three = sphere;
  unit.spec = spec;
  unit.healthBar = addProgressBar(unit);
  unit.setHealth = function(health) {
    unit.health = health;
    unit.healthBar.setProgress(unit.health / unit.spec.maxHealth);
  };
  unit.getHealth = function() {
    return unit.health;
  };
  unit.dead = false;
  unit.remove = function() {
    unit.dead = true;
    unit.healthBar.$progress.remove();
    data.scene.remove(unit.three);
    // TODO: optimize
    data.units = data.units.filter(function(o) {
      return o != unit;
    });
  };
  unit.tick = function() {
    var move = function() {
      var speed = unit.team == 0 ? spec.speed : -spec.speed;
      if (unit.team == 0) {
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
        if (unit.team == unit2.team) continue;
        var dist = unit.three.position.distanceTo(unit2.three.position);
        if (dist < unit2.spec.size + spec.range) {
          targets.push(unit2);
        }
      }
      return targets;
    };
    var attack = function(targets) {
      var attackTime = getGameTime();
      if (unit.lastAttack === undefined ||
          attackTime - unit.lastAttack >= unit.spec.fireRate * 1000.0) {
        for (var i = 0; i < targets.length; i++) {
          var target = targets[i];
          target.setHealth(Math.max(target.getHealth() - spec.damage, 0));
          unit.lastAttack = attackTime;
          // remove dead units
          if (target.getHealth() <= 0) {
            target.remove();
          }
          break;
        }
      }
    };
    var targets = targetsInRange();
    if (targets.length > 0) {
      return {
        category: "attack",
        action: function() {
          attack(targets);
          unit.healthBar.tick();
        }
      };
    } else {
      return {
        category: "move",
        action: function() {
          move();
          unit.healthBar.tick();
        }
      };
    }
  };
  return unit;
}

function getSend(team) {
  return function send() {
    var spec = {
      size: 5,
      speed: 1.0,
      sight: 10,
      range: 50,
      damage: 1.0,
      fireRate: 1.0,
      maxHealth: 5,
    };
    var initial = {
      team: team,
    };
    var unit = addUnit(spec, initial, false);
    var offset = 10;
    unit.three.position.x = 
      unit.team == 0 ?
      data.base1.three.position.x + data.base1.spec.size + offset : 
      data.base2.three.position.x - data.base2.spec.size - offset;
    unit.three.position.y = (Math.random() * 2.0 - 1.0) * data.yBound;
    data.units.push(unit);
  }
}

function connect() {
  if (data.peer.idPromise.isFulfilled()) {
    data.peer.isServer = false;
    var peerId = $("#connectId").val();
    var conn = data.peer.peer.connect(peerId);
    data.peer.clientConnPromise = new Promise(function(resolve, reject) {
      conn.on('open', function() {
        resolve(conn);
      });
    });

    data.peer.clientConnPromise.then(function(conn) {
      conn.on('data', function(received) {
        data.peer.received = received;
        // console.log('Received', received);
      });
    });
  }
}

function setupHandlers() {
  var $send1 = $('#send1');
  $send1.click(getSend(0));
  var $send2 = $('#send2');
  $send2.click(getSend(1));
  var $connect = $('#connect');
  $connect.click(connect);
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

  var light = new THREE.AmbientLight(0x404040); // soft white light
  data.scene.add(light);
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
    size: data.BaseSize,
    speed: 0,
    sight: 10,
    range: 100,
    damage: 5.0,
    fireRate: 1.0,
    maxHealth: 100,
    type: data.UnitType.BASE,
  };
  var initial1 = {
    team: 0,
  };
  var initial2 = {
    team: 1,
  };
  var unit = addUnit(baseSpec, initial1, false);
  unit.three.position.x = -baseOffset;
  data.units.push(unit);
  data.base1 = unit;
 
  var unit = addUnit(baseSpec, initial2, false);
  unit.three.position.x = baseOffset;
  data.units.push(unit);
  data.base2 = unit;
}

function addProgressBar(unit) {
  var progress = {};

  var $progress = $("<div class='myProgress'/>");
  var $bar = $("<div class='myBar'/>");
  var $text = $("<span/>");
  $progress.append($bar);
  $bar.append($text);
  $("body").append($progress);

  progress.setProgress = function(completed) {
    $bar.width(completed * 100 + '%');
    $text.html(formatFloat(completed * 100, 0) + '%');
    progress.completed = completed;
  }
  progress.getProgress = function() {
    return progress.completed;
  }
  progress.$progress = $progress;
  progress.setProgress(1.0);

  progress.tick = function() {
    var pos1 = unit.three.position.clone();
    pos1.x -= unit.spec.size;
    pos1.y += unit.spec.size;
    pos1.z += unit.spec.size;
    var pos2 = unit.three.position.clone();
    pos2.x += unit.spec.size;
    pos2.y += unit.spec.size;
    pos2.z += unit.spec.size;

    var healthWidth = worldToScreen(pos2).x - worldToScreen(pos1).x;
    var healthHeight = 20;
    var center = worldToScreen(unit.three.position);
    var htop = center.y - healthWidth / 2 - healthHeight;
    var hleft = center.x - healthWidth / 2;

    $progress.offset({
      top: htop,
      left: hleft
    });
    $progress.width(healthWidth);
    $progress.height(healthHeight);
  }

  return progress;
}

function checkWin() {
  var message;
  var finished = false;
  if (data.base1.dead && data.base2.dead) {
    message = "GAME TIED!";
    finished = true;
  }
  if (data.base1.dead) {
    message = "RIGHT TEAM WINS!";
    finished = true;
  }
  if (data.base2.dead) {
    message = "LEFT TEAM WINS!";
    finished = true;
  }
  if (finished) {
    h1 = $("<h1 class='final'/>");
    h1.html(message);
    $("body").append(h1);
    h1.offset({
      top: window.innerHeight / 2 - h1.height() / 2,
      left: window.innerWidth / 2 - h1.width() / 2,
    });
  }
  return finished;
}

function serverTick() {
  var elapsed = getGameTime() - data.startTime;
  var moves = [];
  var attacks = [];
  for (var i = 0; i < data.units.length; i++) {
    var unit = data.units[i];
    var delayed = unit.tick();
    if (delayed.category === "attack") {
      attacks.push(delayed.action);
    } else if (delayed.category === "move") {
      moves.push(delayed.action);
    }
  }
  for (var i = 0; i < attacks.length; i++) {
    attacks[i]();
  }
  for (var i = 0; i < moves.length; i++) {
    moves[i]();
  }
}

function serializeUnits() {
  //var serializedSpecs = [];
  // TODO: compress specs
  var serializedUnits = [];
  for (var i = 0; i < data.units.length; i++) {
    var unit = data.units[i];
    var serializedUnit = {
      spec: unit.spec,
      team: unit.team,
      health: unit.health,
      position: [unit.three.position.x, unit.three.position.y, unit.three.position.z]
    };
    serializedUnits.push(serializedUnit);
  }
  return serializedUnits;
}

function sendData() {
  if (data.peer.serverConnPromise.isFulfilled()) {
    var conn = data.peer.serverConnPromise.value();
    var serializedUnits = serializeUnits(data.units);
    conn.send(serializedUnits);
  }
}

function clientTick() {
  if (data.peer.received !== undefined) {
    console.log("updating received");
    var received = data.peer.received;
    data.peer.received = undefined;
    for (var i = 0; i < data.units.length; i++) {
      var unit = data.units[i];
      unit.remove();
    }
    for (var i = 0; i < received.length; i++) {
      var receivedUnit = received[i];
      var initial = {
        health: receivedUnit.health,
        team: receivedUnit.team,
      }
      var unit = addUnit(receivedUnit.spec, initial, true);
      unit.three.position.x = receivedUnit.position[0];
      unit.three.position.y = receivedUnit.position[1];
      unit.three.position.z = receivedUnit.position[2];
      //console.log("xyz", unit.three.position.x, unit.three.position.y, unit.three.position.z);
      data.units.push(unit);
    }
  }
}

function tick() {
  if (data.peer.isServer) {
    serverTick();
    sendData();
    if (!checkWin()) {
      requestAnimationFrame(tick);
    }
  } else {
    clientTick();
    requestAnimationFrame(tick);
  }
}

function update() {
  data.renderer.render(data.scene, data.camera);
  requestAnimationFrame(update);
}

if (checkTestEnvironment()) {
  console.log("test environment");
  var ipcRenderer = require('electron').ipcRenderer;
  if (!checkTestServer()) {
    ipcRenderer.on("peerId", function(e, id) {
      console.log("rendererer on peerId: " + id);
      $("#connectId").val(id);
      connect();
    });
  }
} else {
  console.log("production environment");
}

var data = {};
$(main);
