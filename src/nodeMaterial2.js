import {
  attribute, varying, Fn, 
  float, vec3, color, clamp, max, step, mix,
  positionLocal, transformNormalToView, uniform,
} from 'three/tsl';
import { MeshStandardNodeMaterial, DoubleSide } from 'three/webgpu';

const vHeight = varying(float());
const vNormal = varying(vec3());
const COLLECTION_COLORS =  [
  '#FF6B44',  // Hot orange
  '#00D9ff',  // Electric Cyan
  '#FFD93D',  // Bright Yellow
  '#B84FFF',  // Vivid pinky
  '#959392',  // Deep Orange
  '#078216',  // Deep green
  '#4b0782',  // Deep purple
];
const MAX_TIMELINES = 16;
const bandUniforms = COLLECTION_COLORS.map(hex => uniform(color(hex)));

function bandColor(i) {
  // wrap if more bands than palette entries
  const idx = i % bandUniforms.length;
  return bandUniforms[idx];
}


export const getMat = (g) => {
  const redMat = new MeshStandardNodeMaterial({
    roughness: 0.4,
    metalness: 0.5,
    side: DoubleSide,
    transparent: false,
  });
  
  const numTimelines = g.userData.numTimelines || 0;
  const maxHeight = float(g.userData.maxHeight || 1.0);
  const heightAttr   = attribute('heightBuffer');   // StorageBufferAttribute

  // TIMELINE ATTRIBUTES - MAX IS 16 ///////////////////////////////////////
  // MUST BE EXPLICIT HENCE THE LIST OF CONSTs /////////////////////////////
  //////////////////////////////////////////////////////////////////////////
  const tl0  = attribute('timeline0');
  const tl1  = attribute('timeline1');
  const tl2  = attribute('timeline2');
  const tl3  = attribute('timeline3');
  const tl4  = attribute('timeline4');
  const tl5  = attribute('timeline5');
  const tl6  = attribute('timeline6');
  const tl7  = attribute('timeline7');
  const tl8  = attribute('timeline8');
  const tl9  = attribute('timeline9');
  const tl10 = attribute('timeline10');
  const tl11 = attribute('timeline11');
  const tl12 = attribute('timeline12');
  const tl13 = attribute('timeline13');
  const tl14 = attribute('timeline14');
  const tl15 = attribute('timeline15');

  function getTimeline(i) {
    switch (i) {
      case 0:  return tl0;
      case 1:  return tl1;
      case 2:  return tl2;
      case 3:  return tl3;
      case 4:  return tl4;
      case 5:  return tl5;
      case 6:  return tl6;
      case 7:  return tl7;
      case 8:  return tl8;
      case 9:  return tl9;
      case 10: return tl10;
      case 11: return tl11;
      case 12: return tl12;
      case 13: return tl13;
      case 14: return tl14;
      case 15: return tl15;
      default: return float(0.0);
    }
  }


  //////////////////////////////////////////////////////////////////////////
  // COLOR NODE ////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////
  redMat.colorNode = Fn(() => {

    const eps = float(1e-3);
    const h   = max(positionLocal.y, eps);
    const hn  = clamp(h.div(maxHeight.add(eps)), 0.0, 1.0); // 0..1

    ////////////////////////////////////////////////////////////////////////
    // Calculate total per vertex //////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////
    let total = float(0.0);
    for (let i = 0; i < numTimelines; i++) {
      total = total.add(max(getTimeline(i), eps));
    }
    total = max(total, eps);

    ////////////////////////////////////////////////////////////////////////
    // accumulate edges + band colors  /////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////
    let running  = float(0.0);
    let prevEdge = float(0.0);
    let colorOut = bandColor(0); // base color (band 0)

    for (let i = 0; i < numTimelines; i++) {
      running = running.add(max(getTimeline(i), eps));
      let e = clamp(running.div(total), prevEdge, 1.0);
      prevEdge = e;

      const mask    = step(e, hn);        // 0 before edge i, 1 after
      const nextCol = bandColor(i + 1);   // color for band i+1
      colorOut = mix(colorOut, nextCol, mask);
    }

    return colorOut;

  })();

  return redMat;
};
