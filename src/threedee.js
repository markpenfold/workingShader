import {
  attribute, varying, Fn,
  float, vec3, color, clamp, max, step, mix,
  positionWorld, uniform, positionLocal, div
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

const COLLECTION_COLORS_G = [
  '#4a4a4a',  // Dark charcoal
  '#5e5e5e',  // Mid-dark grey
  '#747474',  // Mid grey
  '#8e8e8e',  // Medium grey
  '#a8a8a8',  // Light-mid grey
  '#c4c4c4',  // Light grey
  '#e2e2e2',  // Near white grey
];

const COLLECTION_COLORS_WG = [
  '#4b4744',  // Dark warm grey
  '#605c59',  // Warm charcoal
  '#78736f',  // Mid warm grey
  '#918c88',  // Greige mid
  '#aba6a2',  // Warm light grey
  '#c6c1bd',  // Pale greige
  '#e3dfdc',  // Warm near-white
];

const COLLECTION_COLORS_RED = [
  '#5c1a1a',  // Deep burgundy
  '#7a2525',  // Dark red
  '#9e3535',  // Mid red
  '#be5555',  // Faded red
  '#d47f7f',  // Dusty rose
  '#e8aaaa',  // Pale pink-red
  '#f7d8d8',  // Blush
];


const COLLECTION_COLORS_GREEN = [
  '#1a3320',  // Deep forest
  '#2a4f32',  // Dark green
  '#3d6b46',  // Mid forest
  '#5a8c62',  // Sage-green
  '#80aa87',  // Muted sage
  '#adc9b2',  // Pale sage
  '#d6ead9',  // Mint whisper
];

const COLLECTION_COLORS_T1 = [
  '#2e3d52',  // Deep Tiepolo shadow blue
  '#5a7a9e',  // Mid sky blue
  '#8faec8',  // Airy cerulean
  '#b8cdd9',  // Pale cloud blue
  '#d9e4e8',  // Gossamer sky
  '#ece8e0',  // Cloud white-cream
  '#f7f4ef',  // Luminous near-white
];


const COLLECTION_COLORS_T2 = [
  '#3d2a1a',  // Deep umber shadow
  '#7a4f2a',  // Warm brown
  '#b87d3e',  // Ochre gold
  '#d4a45a',  // Naples yellow
  '#e8c98a',  // Pale gold
  '#f0ddb0',  // Warm cream
  '#faf3e0',  // Luminous ivory
];


// BEAUTIFUL 
const COLLECTION_COLORS_T3 = [
  '#2e3d52',  // Deep shadow blue (dark sky corners)
  '#5a7a9e',  // Cerulean mid-sky
  '#4a7a4a',  // Muted sage (distant landscape)
  '#b87d3e',  // Ochre gold (gilded drapery)
  '#c97060',  // Venetian rose (flesh / warm drapery)
  '#d9c4a0',  // Pale cream (cloud base)
  '#f2ede4',  // Luminous near-white (zenith sky)
];

const COLLECTION_COLORS_T4 = [
  '#f7f4ef',  // Luminous near-white zenith
  '#dce8f0',  // Pale cloud blue
  '#a8c8de',  // Soft cerulean
  '#6a9bbf',  // Mid sky blue
  '#3d6e9a',  // Strong cerulean
  '#1e4470',  // Deep Tiepolo blue
  '#0d1f3c',  // Midnight vault
];


const COLLECTION_COLORS_T5 = [
  '#faf3e0',  // Blazing ivory light
  '#f0d080',  // Vivid Naples yellow
  '#e0a030',  // Rich ochre gold
  '#c86030',  // Burnt sienna
  '#a03820',  // Deep vermilion
  '#6a2010',  // Dark Venetian red
  '#2e0e08',  // Shadow umber
];


// BEAUTIFUL 
const COLLECTION_COLORS_T6 = [
  '#f2ede4',  // Luminous cloud white
  '#e8c060',  // Vivid Naples yellow
  '#d06040',  // Strong Venetian rose
  '#7ab060',  // Punchy sage green
  '#3a80b0',  // Bold cerulean
  '#1e4060',  // Deep sky blue
  '#1a1a2e',  // Dark shadow vault
];

const bandUniforms = COLLECTION_COLORS_T6.map(hex => uniform(color(hex)));

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
  // but also by average height.
  // min needs to be the min non-zero!
  const minH = uniform(g.userData.minHeight);
  const maxH = uniform(g.userData.maxHeight);
  const avH = g.userData.averageHeight;
  const scaleFactor = uniform(maxH/avH);
  console.log("max",maxH, "minH",minH, "avg", avH);
  //const sampleOffset = uniform(0.0001).mul(scaleFactor).div(positionLocal.y);
  // Normalise this vertex's height within the full range (0..1)
  // Then scale offset so tall peaks sample deeper into their bands
  const heightRange   = maxH.sub(minH).add(float(0.001)); // avoid div/0
  const normalizedY   = clamp(
      positionLocal.y.sub(minH).div(heightRange),
      float(0.0),
      float(1.0)
    );

  // sampleOffset grows with height — tune the multiplier (try 0.3–0.8)
  const sampleOffset = normalizedY.mul(avH).mul(float(0.5));

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

    const heightVariation = mix(
      vec3(0.3, 0.3, 0.3),
      vec3(1.2, 1.2, 1.2),
      clamp(positionLocal.y.mul(0.06), float(0.0), float(1.0)),
    );
    const colorWithHeight = colorOut.mul(heightVariation);

    // Height mask
    const heightMask = step(0.5, positionWorld.y);

    return mix(baseColor, colorWithHeight, heightMask);

  })();

  return redMat;
};
