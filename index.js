import * as THREE from "https://unpkg.com/three@0.126.1/build/three.module.js";

import { OrbitControls } from "https://unpkg.com/three@0.126.1/examples/jsm/controls/OrbitControls.js";
import { ConvexGeometry } from "https://unpkg.com/three@0.126.1/examples/jsm/geometries/ConvexGeometry.js";
import { GUI } from "https://unpkg.com/three@0.126.1/examples/jsm/libs/dat.gui.module.js";

//#region declarations
let camera, scene, renderer, controls, gui, world;
let planeMesh, planeMaterial, gridHelper;
let pointer, raycaster, isShiftDown = false;
let grassTexture, grassNormal, soilTexture, soilNormal, gravelTexture, gravelNormal, stoneTexture, stoneNormal;
let grassMaterial, soilMaterial, gravelMaterial, stoneMaterial;

let rollOverMesh, rollOverMaterial;
let spherePointerGeo, spherePointerMaterial, nodeID;
let outlineGeo, outlineMaterial;
let areaGeo, areaID;
let outlineFinished = new Boolean;


const objects = [];
const nodes = [];
const outlinePoints = [];

const areaTypes = { grass: 'Grass', soil: 'Soil', gravel: 'Gravel', stone: 'Stone' };

const box = new THREE.Box3();

//#endregion declarations

init();

function init() {

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.set(50, 80, 130);
    camera.lookAt(0, 0, 0);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfaedca);

    outlineMaterial = new THREE.LineBasicMaterial({ color: 0xfffffff });    //White, used for lines between area points

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    outlineFinished = false;
    nodeID = 0;
    areaID = 0;

    loadTextures();

    //#region GUI

    gui = new GUI();

    world = {
        plane: {
            width: 100,
            height: 100,
            finalPlane: function() {
                gui.removeFolder(planeFolder);
                console.log("Plane finalised");
            }
        },
        area: {
            createNew: function(){
                resetOutline();
            },
            type: "Grass",
            finishArea: function(){
                finalOutline();
            }
        }
    }

    const planeFolder = gui.addFolder("Plane");     //Plane folder created
    planeFolder.add(world.plane, "width", 10, 300). //Add width slider
        onChange(() => {
            planeMesh.geometry.dispose();           //Remove old plane geo
            planeMesh.geometry = new THREE.PlaneGeometry(world.plane.width, world.plane.height);    //Create new plane geo with slider dimensions
            planeMesh.geometry.rotateX(- Math.PI / 2);  //Rotate to make flat
        });
    planeFolder.add(world.plane, "height", 10, 300).    //Same with height
        onChange(() => {
            planeMesh.geometry.dispose();
            planeMesh.geometry = new THREE.PlaneGeometry(world.plane.width, world.plane.height);
            planeMesh.geometry.rotateX(- Math.PI / 2);
        });
    planeFolder.add(world.plane, "finalPlane").name("Finalise plane");  //Button to finalise plane. Removes plane folder
    planeFolder.open();

    const areaFolder = gui.addFolder("Area");       //Area folder added
    areaFolder.add(world.area, "type").options(areaTypes).  //Add area type dropdown selector
        onChange(() => {
            console.log(world.areaTypes.type);
        });
    areaFolder.add(world.area, "createNew").name("New area");
    areaFolder.add(world.area,"finishArea").name("Finish area");

    areaFolder.open();

    //#endregion GUI

    //#region controls

    controls = new OrbitControls(camera, renderer.domElement);

    controls.listenToKeyEvents(window); // optional

    controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 100
    controls.maxDistance = 1500;
    //controls.maxPolarAngle = Math.PI / 2.3;

    controls.mouseButtons = {
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE
    }
    //#endregion controls

    //#region spheres

    //////roll-over sphere/////

    const rollOverGeo = new THREE.SphereGeometry(4, 32, 32);
    rollOverMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, opacity: 0.5, transparent: true });
    rollOverMesh = new THREE.Mesh(rollOverGeo, rollOverMaterial);
    scene.add(rollOverMesh);

    /////node sphere/////

    spherePointerGeo = new THREE.SphereGeometry(4, 32, 32);
    spherePointerMaterial = new THREE.MeshLambertMaterial({ color: 0xe84118 });

    //#endregion spheres

    //#region raycast

    raycaster = new THREE.Raycaster();
    pointer = new THREE.Vector2();

    //#endregion raycast

    //#region plane & grid

    //gridHelper = new THREE.GridHelper(world.plane.height, 20, 0x000000, 0x3b3b3b);
    //gridHelper.position.y += 1;
    //scene.add(gridHelper);

    const planeGeo = new THREE.PlaneGeometry(100, 100);
    planeGeo.rotateX(- Math.PI / 2);

    planeMesh = new THREE.Mesh(planeGeo, grassMaterial);
    planeMesh.name = "plane";
    scene.add(planeMesh);

    objects.push(planeMesh);

    //#endregion plane & grid

    //#region lights

    const ambientLight = new THREE.AmbientLight(0x606060);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff);
    directionalLight.position.set(1, 0.75, 0.5).normalize();
    scene.add(directionalLight);

    //#endregion lights

    //#region listeners

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onDocumentKeyDown);
    document.addEventListener('keyup', onDocumentKeyUp);
    window.addEventListener('resize', onWindowResize);

    //#endregion listeners


}

function loadTextures() {
    grassTexture = new THREE.TextureLoader().load('textures/grass/diffuse.jpg');
    grassTexture.wrapS = THREE.RepeatWrapping;
    grassTexture.wrapT = THREE.RepeatWrapping;
    grassTexture.repeat.set(4, 4);

    grassNormal = new THREE.TextureLoader().load('textures/grass/normal.jpg');
    grassNormal.wrapS = THREE.RepeatWrapping;
    grassNormal.wrapT = THREE.RepeatWrapping;
    grassNormal.repeat.set(4, 4);

    grassMaterial = new THREE.MeshPhongMaterial({
        color: 0xdddddd,
        specular: 0x222222,
        shininess: 5,
        map: grassTexture,
        normalMap: grassNormal,
        side: THREE.DoubleSide
    })

    soilTexture = new THREE.TextureLoader().load('textures/soil/diffuse.jpg');
    soilTexture.wrapS = THREE.RepeatWrapping;
    soilTexture.wrapT = THREE.RepeatWrapping;
    soilTexture.repeat.set(4, 4);

    soilNormal = new THREE.TextureLoader().load('textures/soil/normal.jpg');
    soilNormal.wrapS = THREE.RepeatWrapping;
    soilNormal.wrapT = THREE.RepeatWrapping;
    soilNormal.repeat.set(4, 4);

    soilMaterial = new THREE.MeshPhongMaterial({
        color: 0xdddddd,
        specular: 0x222222,
        shininess: 5,
        map: soilTexture,
        normalMap: soilNormal,
        side: THREE.DoubleSide
    })

    gravelTexture = new THREE.TextureLoader().load('textures/gravel/diffuse.jpg');
    gravelTexture.wrapS = THREE.RepeatWrapping;
    gravelTexture.wrapT = THREE.RepeatWrapping;
    gravelTexture.repeat.set(4, 4);

    gravelNormal = new THREE.TextureLoader().load('textures/gravel/normal.jpg');
    gravelNormal.wrapS = THREE.RepeatWrapping;
    gravelNormal.wrapT = THREE.RepeatWrapping;
    gravelNormal.repeat.set(4, 4);

    gravelMaterial = new THREE.MeshPhongMaterial({
        color: 0xdddddd,
        specular: 0x222222,
        shininess: 5,
        map: gravelTexture,
        normalMap: gravelNormal,
        side: THREE.DoubleSide
    })

    stoneTexture = new THREE.TextureLoader().load('textures/stone/diffuse.png');
    stoneTexture.wrapS = THREE.RepeatWrapping;
    stoneTexture.wrapT = THREE.RepeatWrapping;
    stoneTexture.repeat.set(4, 4);

    stoneNormal = new THREE.TextureLoader().load('textures/stone/normal.png');
    stoneNormal.wrapS = THREE.RepeatWrapping;
    stoneNormal.wrapT = THREE.RepeatWrapping;
    stoneNormal.repeat.set(4, 4);

    stoneMaterial = new THREE.MeshPhongMaterial({
        color: 0xdddddd,
        specular: 0x222222,
        shininess: 5,
        map: stoneTexture,
        normalMap: stoneNormal,
        side: THREE.DoubleSide
    })
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

    //render();
}

function onPointerDown(event) {

    switch (event.which) {
        case 1: //left click
            if (!outlineFinished) {

                pointer.set((event.clientX / window.innerWidth) * 2 - 1, - (event.clientY / window.innerHeight) * 2 + 1);
                raycaster.setFromCamera(pointer, camera);
                const intersects = raycaster.intersectObjects(objects);

                if (intersects.length > 0) {    //If ray intersects with something

                    const intersect = intersects[0];
                    if (objects.includes(intersect.object));    //if intersect is included in the objects array
                    {
                        const nodeMesh = new THREE.Mesh(spherePointerGeo, spherePointerMaterial);   //Create mesh for solid sphere
                        nodeMesh.position.copy(intersect.point).add(intersect.face.normal);         //set mesh to intersect position
                        scene.add(nodeMesh);        //Add mesh to scene

                        nodeMesh.name = "node " + nodeID;   //Give the node a name 
                        nodeID++;       //increment id 
                        nodes.push(nodeMesh);               //Push node to the array of nodes
                        console.log("Pushed node ID:" + nodeID);

                        const pos = nodeMesh.position;     //temp variable to store the point
                        outlinePoints.push(new THREE.Vector3(pos.x, pos.y, pos.z));
                        console.log("Added point at x:" + pos.x.toFixed(2) + "  y:" + pos.y.toFixed(2) + "  z:" + pos.x.toFixed(2));

                        if (outlinePoints.length > 1) {
                            drawLine();
                        }

                        if (outlinePoints.length == 4) {    //Finishes the outline on four points
                            finalOutline();
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

    requestAnimationFrame(render);
    controls.update();
    renderer.render(scene, camera);
}
render();

function drawLine() {
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

        let selectedMat;

        switch (world.area.type) {     //Switches the material based on mat selected in UI
            case "Grass":
                selectedMat = grassMaterial;
                break;
            case "Soil":
                selectedMat = soilMaterial;
                break;
            case "Gravel":
                selectedMat = gravelMaterial;
                break;
            case "Stone":
                selectedMat = stoneMaterial;
                break;
        }

        const areaMesh = new THREE.Mesh(areaGeo, selectedMat);  //Create the mesh with the selected material
        areaMesh.name = "area" + areaID;    //Gives the area a name and id
        areaID++;   //increment id
        scene.add(areaMesh);    //Add mesh to the scene
        areaMesh.position.y -= 0.9; //Makes the area level (just above) the plane
    }
}

function resetOutline() {
    for (let i in nodes) {
        scene.remove(nodes[i].object);
        nodes[i].geometry.dispose();
        console.log("Removed element: " + i.toString());
    }
    nodes.length = 0;
    outlinePoints.length = 0;
    //outlineGeo.geometry.dispose();

    outlineFinished = false;
}