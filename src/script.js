import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { updatePlane10 } from './helpers.js'
import { getMat } from './nodeMaterial2.js';
import { dum_dum } from '../dd.js';


let camera, scene, renderer, controls;



const BOARD_SIZE = 200;




// curve sampling
const curve_points = 32;
// peak[0] is IGNORED!
let peak = [1,5,1,1,1,1];
let peak2 = [1,5,5,1,1,1];

let output = [[10, 1,1,1,1,5]];

for(let x=0; x<499; x++){
    output.push([0,0,0,0,0,0])
}
output.push(peak);
output.push([0,0,0,0,0,0])
output.push([0,0,0,0,0,0])
output.push([0,0,0,0,0,0])
output.push([0,0,0,0,0,0])
output.push(peak2);

for(let x=0; x<518; x++){
    output.push([0,0,0,0,0,0])
}


const planeGeo = new THREE.PlaneGeometry(BOARD_SIZE, BOARD_SIZE, curve_points-1, curve_points-1);
planeGeo.rotateX(-Math.PI / 2); // make its normal point up +Y
const g2 = updatePlane10(planeGeo, dum_dum, curve_points);
const terrainMat = getMat(g2);
const terrainMesh = new THREE.Mesh(g2, terrainMat);

init();




function init() {
  
  // Camera
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    10000
  );
 camera.position.set(0, 170, 170); // or (800, 800, 800)
camera.lookAt(0, 0, 0);

// Scene
scene = new THREE.Scene();
scene.background = new THREE.Color(0x202020);
//scene.background = color('#fff999');
scene.backgroundBlurriness = 0.5;
scene.add(terrainMesh);
terrainMesh.position.set(0,0,0);
camera.lookAt(0, 0, 0);
//scene.add(pts);

// lights
const directionalLight = new THREE.DirectionalLight( '#ffffff',1.1 );
directionalLight.position.set( 110, 100, -10 );
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.set( 1024, 1024 );
directionalLight.shadow.camera.left = -150;
directionalLight.shadow.camera.right = 150;
directionalLight.shadow.camera.top = 150;
directionalLight.shadow.camera.bottom = -150;
directionalLight.shadow.camera.near = 1;
directionalLight.shadow.camera.far = 400;
directionalLight.shadow.normalBias = 0.05;
directionalLight.shadow.bias = 0.5;
directionalLight.lookAt(0,0,0);


const directionalLight2 = new THREE.DirectionalLight( '#ffffff',1.1 );
directionalLight2.position.set( -110, 100, -100 );
directionalLight2.castShadow = true;
directionalLight2.shadow.mapSize.set( 1024, 1024 );
directionalLight2.shadow.camera.left = -150;
directionalLight2.shadow.camera.right = 150;
directionalLight2.shadow.camera.top = 150;
directionalLight2.shadow.camera.bottom = -150;
directionalLight2.shadow.camera.near = 1;
directionalLight2.shadow.camera.far = 400;
directionalLight2.shadow.normalBias = 0.05;
directionalLight2.shadow.bias = 0.5;
directionalLight2.lookAt(0,0,0);
const helper2 = new THREE.DirectionalLightHelper( directionalLight2, 5 );
scene.add(helper2)





const helper = new THREE.DirectionalLightHelper( directionalLight, 5 );
scene.add(helper)
const axis = new THREE.AxesHelper(100);
scene.add(axis);
scene.add( directionalLight );

const light = new THREE.HemisphereLight( 0xfffffb, 0xffc266, 2 );
//scene.add( light );

  
renderer = new THREE.WebGPURenderer( { antialias: true } );
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.setPixelRatio( window.devicePixelRatio );
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setAnimationLoop( animate );
document.body.appendChild( renderer.domElement );

controls = new OrbitControls( camera, renderer.domElement );

controls.enableDamping = true;
controls.minDistance = 0.1;
controls.maxDistance = 5000;
window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize( window.innerWidth, window.innerHeight );
}

async function animate() {
  controls.update();
  renderer.render( scene, camera );
}