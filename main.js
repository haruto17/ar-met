import * as THREE from "three";
import { ARButton } from "three/addons/webxr/ARButton.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";
import WebXRPolyfill from "webxr-polyfill";

const polyfill = new WebXRPolyfill();

let objectIDs = [];

// scene
const scene = new THREE.Scene();

// camera
const camera = new THREE.PerspectiveCamera(
  80,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

// camera container
const cameraContainer = new THREE.Group();
cameraContainer.add(camera);
cameraContainer.position.set(0, 0, 10);
scene.add(cameraContainer);

// renderer
const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector("#mycanvas"),
  antialias: true,
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

// ARButton
document.body.appendChild(ARButton.createButton(renderer));

// right controller
const ctrModelFactory = new XRControllerModelFactory();
const ctr_r = renderer.xr.getController(1);
cameraContainer.add(ctr_r);
const ctr_r_grip = renderer.xr.getControllerGrip(1);
const ctr_r_model = ctrModelFactory.createControllerModel(ctr_r_grip);
ctr_r_grip.add(ctr_r_model);
cameraContainer.add(ctr_r_grip);

// light
const light0 = new THREE.AmbientLight(0xffffff, 2.0);
scene.add(light0);

let painting;
let painting_title = "";
let painting_artist = "";

let last_time = new Date();

const fontLoader = new FontLoader();

// animation
function tick() {
  let now_time = Date.now();
  if (ctr_r_model.motionController) {
    var json = JSON.stringify(ctr_r_model.motionController.data, null, " ");
    var input = JSON.parse(json);

    // if push A button
    if (input[3].button == 1) {
      if (Math.floor((now_time - last_time) / 1000) >= 5) {
        removeFromScene();
        // get next paint
        setImage();
        last_time = now_time;
      }
    }
  }

  renderer.render(scene, camera);
}
renderer.setAnimationLoop(tick);

window.addEventListener("load", onLoadWindow);
async function onLoadWindow() {
  await getObjectData();
  await setImage();
}

function removeFromScene() {
  scene.remove(painting);
  painting.material.dispose();
  painting.geometry.dispose();

  scene.remove(painting_title);
  painting_title.material.dispose();
  painting_title.geometry.dispose();

  scene.remove(painting_artist);
  painting_artist.material.dispose();
  painting_artist.geometry.dispose();
}

async function getObjectData() {
  const response = await fetch(
    "https://collectionapi.metmuseum.org/public/collection/v1/objects?departmentIds=19"
  );
  const json = JSON.stringify(await response.json());
  objectIDs = JSON.parse(json).objectIDs;
}

async function getImageFromURL() {
  const id = Math.floor(Math.random() * objectIDs.length);
  const err_json = {
    message: "error",
  };
  try {
    const response = await fetch(
      "https://collectionapi.metmuseum.org/public/collection/v1/objects/" + id
    );
    if (!response.ok) {
      throw new Error(response.status);
    }
    const jsonstr = JSON.stringify(await response.json());
    const json = JSON.parse(jsonstr);
    console.log(json);
    return json;
  } catch (error) {
    console.error(error);
    return err_json;
  }
}

async function setImage() {
  const image_data = await getImageFromURL();

  last_time = new Date();

  const font = await fontLoader.loadAsync(
    "droid_sans_mono_regular.typeface.json.json"
  );

  const image = new Image();
  let artist = "";
  let title = "";

  if ("message" in image_data || image_data.primaryImage == "") {
    image.src = "error.png";
    artist = "undefined";
    title = "undefined";
  } else {
    image.src = image_data.primaryImage;
    if (image_data.artistDisplayName == "") {
      artist = "unknown";
    } else {
      artist = image_data.artistDisplayName;
    }

    if (image_data.title == "") {
      title = "unknown";
    } else {
      title = image_data.title;
    }
  }

  image.crossOrigin = "anonymous";

  image.onload = () => {
    let canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext("2d").drawImage(image, 0, 0);

    // convert to base64
    let src = canvas.toDataURL(image, "image/png");
    const texture = new THREE.TextureLoader().load(src, (tex) => {
      const w = 5;
      const h = tex.image.height / (tex.image.width / w);
      const geometry = new THREE.PlaneGeometry(1, 1);
      const material = new THREE.MeshPhongMaterial({ map: texture });
      painting = new THREE.Mesh(geometry, material);
      painting.scale.set(w, h, 1);
      scene.add(painting);

      // set painting title
      painting_title = new THREE.Mesh(
        new TextGeometry(title, {
          font: font,
          size: 8,
          height: 0.1,
        }),
        new THREE.MeshBasicMaterial({
          color: "white",
          transparent: true,
        })
      );
      painting_title.geometry.center();
      painting_title.scale.set(0.08, 0.08, 0.08);
      painting_title.position.set(0, -5, 0);
      scene.add(painting_title);

      // set artist name
      painting_artist = new THREE.Mesh(
        new TextGeometry(artist, {
          font: font,
          size: 8,
          height: 0.1,
        }),
        new THREE.MeshBasicMaterial({
          color: "white",
          transparent: true,
        })
      );
      painting_artist.geometry.center();
      painting_artist.scale.set(0.08, 0.08, 0.08);
      painting_artist.position.set(0, -6, 0);
      scene.add(painting_artist);
    });
  };
}

// if window resize
window.addEventListener("resize", onResize);
function onResize() {
  renderer.setPixelRatio(window.devicePixelRatio);

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
