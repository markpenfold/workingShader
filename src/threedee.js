import {
  attribute, varying, Fn,
  float, vec3, color, clamp, max, step, mix,
  positionWorld, uniform, positionLocal
} from 'three/tsl';

import { MeshStandardNodeMaterial, DoubleSide } from 'three/webgpu';


const COLLECTION_COLORS = [
  '#cbb6b1',  // Hot orange
  '#7d8d90',  // Electric Cyan
  '#e9e7df',  // Bright Yellow
  '#4e4952',  // Vivid pinky
  '#959392',  // Deep Orange
  '#2e322f',  // Deep green
  '#fdcbfe',  // Deep purple
];


const COLLECTION_COLORS2 = [
  '#FF6B44',  // Hot orange
  '#00D9ff',  // Electric Cyan
  '#FFD93D',  // Bright Yellow
  '#B84FFF',  // Vivid pinky
  '#959392',  // Deep Orange
  '#078216',  // Deep green
  '#4b0782',  // Deep purple
];

const bandUniforms = COLLECTION_COLORS.map(hex => uniform(color(hex)));

function bandColor(i) {
  const idx = i % bandUniforms.length;
  return bandUniforms[idx];
}

export const getMat3 = (g) => {
  const redMat = new MeshStandardNodeMaterial({
    roughness: 0.4,
    metalness: 0.5,
    side: DoubleSide,
    transparent: false,
  });

  const numTimelines = g.userData.numTimelines || 0;
  
  // This needs to be scaled by the maxHeight.
  //const sampleOffset = uniform(0.01).mul(g.userData.maxHeight); // tune: world units below surface to sample
  const sampleOffset = uniform(0.001).mul(positionLocal.y);


  // Band boundary attributes — cumulative log-scaled world Y per layer
  const b0  = attribute('band0');
  const b1  = attribute('band1');
  const b2  = attribute('band2');
  const b3  = attribute('band3');
  const b4  = attribute('band4');
  const b5  = attribute('band5');
  const b6  = attribute('band6');
  const b7  = attribute('band7');
  const b8  = attribute('band8');
  const b9  = attribute('band9');
  const b10 = attribute('band10');
  const b11 = attribute('band11');
  const b12 = attribute('band12');
  const b13 = attribute('band13');
  const b14 = attribute('band14');
  const b15 = attribute('band15');

  function getBand(i) {
    switch (i) {
      case 0:  return b0;
      case 1:  return b1;
      case 2:  return b2;
      case 3:  return b3;
      case 4:  return b4;
      case 5:  return b5;
      case 6:  return b6;
      case 7:  return b7;
      case 8:  return b8;
      case 9:  return b9;
      case 10: return b10;
      case 11: return b11;
      case 12: return b12;
      case 13: return b13;
      case 14: return b14;
      case 15: return b15;
      default: return float(0.0);
    }
  }

  redMat.colorNode = Fn(() => {
    //return vec3(1.0, 0, 0);
    const baseColor = vec3(0.0, 0.0, 0.0);

    // Shift sample point below the actual surface
    const sampleY = positionLocal.y.sub(sampleOffset);

    //const sampleY = positionWorld.y.sub(sampleOffset);

    let colorOut = bandColor(0);
    for (let i = 0; i < numTimelines; i++) {
      const mask = step(getBand(i), sampleY);
      colorOut = mix(colorOut, bandColor(i + 1), mask);
    }

    

    // Height mask
    const heightMask = step(0.5, positionWorld.y);

    return mix(baseColor, colorOut, heightMask);

  })();

  return redMat;
};
