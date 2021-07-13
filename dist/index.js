import * as THREE from "https://unpkg.com/three@0.126.1/build/three.module.js";

import { OrbitControls } from "https://unpkg.com/three@0.126.1/examples/jsm/controls/OrbitControls.js";
import { ConvexGeometry } from "https://unpkg.com/three@0.126.1/examples/jsm/geometries/ConvexGeometry.js";

let camera, scene, renderer, controls;
let planeMesh, planeMaterial;
let pointer, raycaster, isShiftDown = false;

let rollOverMesh, rollOverMaterial;
let spherePointerGeo, spherePointerMaterial, nodeID;
let outlineGeo, outlineMaterial;
let areaGeo, areaMaterial;
let outlineFinished = new Boolean;

const objects = [];
const nodes = [];
const lines = [];
const outlinePoints = [];

const box = new THREE.Box3();

init();
render();

function init() {

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.set(500, 800, 1300);
    camera.lookAt(0, 0, 0);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfaedca);

    outlineMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff });

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    outlineFinished = false;
    nodeID = 0;

    /////controls/////

    controls = new OrbitControls(camera, renderer.domElement);

    controls.listenToKeyEvents(window); // optional

    controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 100
    controls.maxDistance = 1500;
    controls.maxPolarAngle = Math.PI / 2.3;

    controls.mouseButtons = {
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE
    }

    /////roll-over sphere/////

    const rollOverGeo = new THREE.SphereGeometry(35, 32, 32);
    rollOverMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, opacity: 0.5, transparent: true });
    rollOverMesh = new THREE.Mesh(rollOverGeo, rollOverMaterial);
    scene.add(rollOverMesh);

    /////node sphere/////

    spherePointerGeo = new THREE.SphereGeometry(35, 32, 32);
    spherePointerMaterial = new THREE.MeshLambertMaterial({ color: 0xe84118 });

    //

    raycaster = new THREE.Raycaster();
    pointer = new THREE.Vector2();

    /////plane & grid/////

    const gridHelper = new THREE.GridHelper(1000, 20, 0x000000, 0x3b3b3b);
    scene.add(gridHelper);
    gridHelper.position.y += 1;

    const planeGeo = new THREE.PlaneGeometry(1000, 1000);
    planeGeo.rotateX(- Math.PI / 2);

    const textureLoader = new THREE.TextureLoader();

    planeMaterial = new THREE.MeshPhongMaterial({
        color: 0xdddddd,
        specular: 0x222222,
        shininess: 5,
        map: textureLoader.load('textures/grass/diffuse.jpg'),
        normalMap: textureLoader.load('textures/grass/normal.jpg'),
        side: THREE.DoubleSide
    })

    planeMesh = new THREE.Mesh(planeGeo, planeMaterial);
    planeMesh.name = "plane";
    scene.add(planeMesh);

    objects.push(planeMesh);

    /////lights/////

    const ambientLight = new THREE.AmbientLight(0x606060);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff);
    directionalLight.position.set(1, 0.75, 0.5).normalize();
    scene.add(directionalLight);

    /////listeners/////

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onDocumentKeyDown);
    document.addEventListener('keyup', onDocumentKeyUp);

    //

    window.addEventListener('resize', onWindowResize);

}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

}

function onPointerMove(event) {


    pointer.set((event.clientX / window.innerWidth) * 2 - 1, - (event.clientY / window.innerHeight) * 2 + 1);

    raycaster.setFromCamera(pointer, camera);

    const intersects = raycaster.intersectObjects(objects);

    if (intersects.length > 0) {

        const intersect = intersects[0];
        if (!outlineFinished) {
            rollOverMesh.visible = true;
            rollOverMesh.position.copy(intersect.point).add(intersect.face.normal);
            //rollOverMesh.position.divideScalar(50).floor().multiplyScalar(50).addScalar(25);
        }
        else {
            rollOverMesh.visible = false;
        }

    }

    render();
}

function onPointerDown(event) {

    switch (event.which) {
        case 1: //left click

            if (!outlineFinished) {
                pointer.set((event.clientX / window.innerWidth) * 2 - 1, - (event.clientY / window.innerHeight) * 2 + 1);
                raycaster.setFromCamera(pointer, camera);
                const intersects = raycaster.intersectObjects(objects);

                if (intersects.length > 0) {

                    const intersect = intersects[0];
                    if (objects.includes(intersect.object));
                    {
                        const nodeMesh = new THREE.Mesh(spherePointerGeo, spherePointerMaterial);
                        nodeMesh.position.copy(intersect.point).add(intersect.face.normal);
                        //voxel.position.divideScalar(50).floor().multiplyScalar(50).addScalar(25);
                        scene.add(nodeMesh);
                        nodeMesh.name = "node " + nodeID;
                        nodeID++;
                        nodes.push(nodeMesh);
                        console.log("Pushed node ID:" + nodeID);

                        const pos = nodeMesh.position;     //temp variable to store the point
                        outlinePoints.push(new THREE.Vector3(pos.x, pos.y, pos.z));
                        console.log("Added point at x:" + pos.x.toFixed(2) + "  y:" + pos.y.toFixed(2) + "  z:" + pos.x.toFixed(2));

                        if (outlinePoints.length > 1) {
                            drawLine();
                        }
                    }

                }
            }
            break;
        case 2: //middle mouse
            break;
        case 3: //right mouse
            break;
    }



    render();
}

function onDocumentKeyDown(event) {

    switch (event.keyCode) {
        case 13: finalOutline(); break;
        case 16: isShiftDown = true; break;
        case 82: resetOutline(); break;
    }

}

function onDocumentKeyUp(event) {

    switch (event.keyCode) {

        case 16: isShiftDown = false; break;
    }

}

function render() {

    controls.update();
    renderer.render(scene, camera);
}

function drawLine() {
    //console.log("Draw outline");
    scene.remove(scene.getObjectByName("outline")); //Deletes the old line object for efficiency

    outlineGeo = new THREE.BufferGeometry().setFromPoints(outlinePoints);
    const lineMesh = new THREE.Line(outlineGeo, outlineMaterial);
    lineMesh.name = "outline";
    scene.add(lineMesh);
}

function finalOutline() {
    if (outlinePoints.length > 2) {
        console.log("Final outline");
        outlinePoints.push(new THREE.Vector3(outlinePoints[0].x, outlinePoints[0].y, outlinePoints[0].z));
        drawLine();
        render();
        outlineFinished = true;

        areaGeo = new ConvexGeometry(outlinePoints);
        areaMaterial = new THREE.MeshBasicMaterial({ color: 0x44bd32, opacity: 0.6, transparent: true });
        const areaMesh = new THREE.Mesh(areaGeo, areaMaterial);
        areaMesh.name = "area";
        scene.add(areaMesh);
        areaMesh.position.y += 2;
    }
}

function resetOutline() {
    for (let i in nodes) {
        scene.remove(nodes[i].object);
        console.log("Removed element: " + i.toString());
    }
    nodes.length = 0;
    outlinePoints.length = 0;

    outlineFinished = false;
}