import {
  Color, DirectionalLight, Group, HemisphereLight, Mesh, MeshStandardMaterial,
  OrthographicCamera, Scene, SphereGeometry, WebGLRenderer,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type Cargo = 'books' | 'parcel' | 'paper' | 'cards' | 'tablet' | 'guide';
export type Pose = { time: number; stride: number; walking: number; turn: number; wave: number; nod: number; reach: number; carrying: boolean };

export function makeCompanion(canvas: HTMLCanvasElement, color: string, cargo: Cargo) {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(116, 116, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new Scene();
  const camera = new OrthographicCamera(-1.55, 1.55, 1.55, -1.55, .1, 20);
  camera.position.set(0, 2.15, 8);
  camera.lookAt(0, 1.27, 0);
  scene.add(new HemisphereLight(0xfff9ef, 0xa1a9ba, 1.9));
  const key = new DirectionalLight(0xfff0da, 2.9);
  key.position.set(-4, 6, 4);
  const rim = new DirectionalLight(0xf1f6ff, 2.4);
  rim.position.set(3, 3, -3);
  scene.add(key, rim);

  const group = (parent: Group | Scene, x = 0, y = 0, z = 0) => {
    const part = new Group();
    parent.add(part);
    part.position.set(x, y, z);
    return part;
  };
  const ball = new SphereGeometry(1, 32, 24);
  const rounded = new RoundedBoxGeometry(1, 1, 1, 5, .28);
  const slim = new RoundedBoxGeometry(1, 1, 1, 3, .08);
  const materials = new Map<string, MeshStandardMaterial>();
  function part(parent: Group, shape: typeof ball | typeof rounded, paint: string, x: number, y: number, z: number, w: number, h: number, d: number) {
    if (!materials.has(paint)) materials.set(paint, new MeshStandardMaterial({ color: new Color(paint), roughness: paint === '#24252a' ? .24 : .68, metalness: .05 }));
    const mesh = new Mesh(shape, materials.get(paint));
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    parent.add(mesh);
    return mesh;
  }
  const root = group(scene);
  const body = group(root, 0, .7);
  part(body, ball, color, 0, .13, 0, .49, .57, .37);
  const head = group(body, 0, 1.05);
  part(head, rounded, color, 0, 0, -.02, 1.62, 1.14, 1.02);
  part(head, rounded, '#475057', 0, -.04, .26, 1.49, .98, .58);
  part(head, rounded, '#24252a', 0, -.05, .32, 1.43, .91, .54);
  const eyes = [-1, 1].map(s => part(head, ball, '#fff1d5', s * .3, -.03, .594, .080, .145, .032));
  const legs = [-1, 1].map(s => {
    const leg = group(root, s * .235, .62);
    part(leg, rounded, color, 0, -.24, 0, .39, .55, .43);
    part(leg, rounded, '#e8d9bf', 0, -.47, .04, .41, .17, .49);
    return leg;
  });
  const arms = [-1, 1].map(s => {
    const arm = group(body, s * .42, .41);
    part(arm, ball, color, s * .055, -.17, .015, .15, .24, .16);
    part(arm, ball, color, s * .085, -.37, .052, .16, .17, .17);
    return arm;
  });
  const load = group(body, 0, .10, .46);
  function book(y: number, cover: string, skew: number) {
    const item = group(load, 0, y, 0);
    item.rotation.y = skew;
    part(item, slim, cover, 0, 0, 0, .8, .12, .48);
    part(item, slim, '#f4e4bf', .022, .002, .012, .77, .077, .47);
    part(item, slim, cover, -.38, 0, 0, .055, .12, .47);
  }
  if (cargo === 'parcel') {
    part(load, slim, '#c98562', 0, .13, 0, .68, .45, .45);
    part(load, slim, '#f2d696', 0, .13, 0, .12, .46, .46);
  } else if (cargo === 'tablet' || cargo === 'paper') {
    const tablet = cargo === 'tablet';
    part(load, slim, tablet ? '#525665' : '#e8dfcb', 0, .16, 0, .65, .46, .09);
    if (tablet) part(load, slim, '#7ab7bc', 0, .17, .05, .54, .32, .025);
    else for (let i = 0; i < 3; i++) part(load, slim, '#586267', -.03, .29 - .095 * i, .05, .47, .034, .012);
  } else {
    book(0, cargo === 'cards' ? '#88669e' : '#52786e', -.09);
    book(.13, cargo === 'guide' ? '#547a95' : '#ba6c54', .08);
  }
  return {
    draw({ time, stride, walking, turn, wave, nod, reach, carrying }: Pose) {
      const step = Math.sin(stride) * walking;
      root.rotation.y = turn;
      root.position.y = Math.abs(step) * .065;
      body.rotation.z = step * .036;
      body.rotation.x = reach * .32;
      head.rotation.z = -.075 + step * .018 + wave * .09;
      head.rotation.x = .035 + nod * .23 + reach * .14;
      head.position.y = 1.05 + .013 * Math.sin(time * 2.3);
      const blink = 1 - .91 * Math.max(0, 1 - Math.abs((time % 4.7) - 4.4) / .11);
      eyes.forEach(eye => { eye.scale.y = .145 * blink; });
      legs.forEach((leg, i) => {
        leg.rotation.x = (i ? step : -step) * .55;
        leg.position.y = .62 + Math.max(0, i ? step : -step) * .09;
      });
      arms.forEach((arm, i) => {
        arm.rotation.x = carrying ? -.95 : (i ? -step : step) * .38;
        arm.rotation.z = (i ? 1 : -1) * (carrying ? -.22 : .13);
      });
      arms[1].rotation.z += wave * 2.48;
      load.visible = carrying;
      renderer.render(scene, camera);
    },
    dispose() {
      ball.dispose(); rounded.dispose(); slim.dispose();
      materials.forEach(material => material.dispose());
      renderer.dispose();
    },
  };
}
