import * as THREE from "https://unpkg.com/three@0.126.1/build/three.module.js";

import { OrbitControls } from "https://unpkg.com/three@0.126.1/examples/jsm/controls/OrbitControls.js";
import { ConvexGeometry } from "https://unpkg.com/three@0.126.1/examples/jsm/geometries/ConvexGeometry.js";
import { GUI } from "https://unpkg.com/three@0.126.1/examples/jsm/libs/dat.gui.module.js";
import { GLTFLoader } from "https://unpkg.com/three@0.126.1/examples/jsm/loaders/GLTFLoader.js";

//#region declarations
let camera, listener, scene, renderer, controls, gui, world;
let hemiLight, sunLight;
let planeMesh;
let pointer, raycaster;
let markerSound, spawnSound, deleteSound;

let grassTexture, grassNormal, soilTexture, soilNormal, gravelTexture, gravelNormal, stoneTexture, stoneNormal, gridTexture;
let grassMaterial, soilMaterial, gravelMaterial, stoneMaterial, gridMaterial;

let rollOverMesh, rollOverMaterial;
let objectRolloverMesh, objectRolloverMaterial;
let nodeID, objectID;
let outlineGeo, outlineMaterial;
let gridGeo, gridMesh, gridSnapFactor;
let areaGeo, areaID, areaHeightOffset, planeGeo;
let outlineFinished = new Boolean;

const objects = [];
const nodes = [];
const areas = [];
const outlinePoints = [];
const placedObjects = [];

const areaTypes = { grass: 'Grass', soil: 'Soil', gravel: 'Gravel', stone: 'Stone' };

const placableObjects = {
    trees:{
        tree1: "Tree 1", tree2: "Tree 2", tree3: "Tree 3"
    },
    flowers:{
        pot: "Pot", redFlower: "Red flower", whiteFlower: "White flower", sunflower: "Sunflower"
    },
    bushes:{
        bush1: "Bush 1", bush2: "Bush 2", bush3: "Bush 3"
    },
    furniture:{
        benches:{
            bench1: "Bench 1", bench2: "Bench 2", bench3: "Bench 3"
        },
        chairs:{
            chair1: "Chair 1", chair2: "Chair 2", chair3: "Chair 3"
        },
        tables:{
            table1: "Table 1", table2: "Table 2", table3: "Table 3"
        }
    }
}

const mouseMode = {
    none: "None",
    areaDef: "Area definition",
    objectPlace: "Object place",
    objectRemove: "Object remove",
    objectMove: "Object move"
}

let currentMouseMode = mouseMode.areaDef;

let currentObject, currentObjectPath, isMoving, currentScale, currentRotation;

//#endregion declarations

init();

function init() {

    //#region renderer and scene setup

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfaedca);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;

    document.body.appendChild(renderer.domElement);

    loadTextures();

    //#endregion renderer and scene setup

    //#region lights

    hemiLight = new THREE.HemisphereLight(0xffeeb1, 0x080820, 1);
    scene.add(hemiLight);

    sunLight = new THREE.SpotLight(0xffa95c,1);
    sunLight.position.set(-50,100,50);
    sunLight.castShadow = true;
    sunLight.shadow.bias = -0.0001;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 500;

    scene.add(sunLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(1, 0.75, 0.5).normalize();
    directionalLight.castShadow = true;

    directionalLight.shadow.mapSize.width = 512;
    directionalLight.shadow.mapSize.height = 512;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;

    //scene.add(directionalLight);

    const sphereGeometry = new THREE.SphereGeometry( 5, 32, 32 );
    const sphereMaterial = new THREE.MeshStandardMaterial( { color: 0xfff000 } );
    const sphere = new THREE.Mesh( sphereGeometry, sphereMaterial );
    sphere.position.set(0,7,0);
    sphere.castShadow = true;
    sphere.receiveShadow = true;
    //scene.add( sphere );
    //#endregion lights

    //#region GUI

    gui = new GUI();    //create the gui

    gui.width = 300;

    world = {
        plane: {            //Controls for the plane
            width: 100,     //change width
            height: 100,    //change height
            type: "Grass",
            grid: true,
            snapToGrid: true,
            finalPlane: function() {    //Finalise the plane. Removes the folder so plane can't be changed again
                gui.removeFolder(planeFolder);
                console.log("Plane finalised");
            }
        },
        area: {     //Controls for area creation
            type: "Grass",          //Dropdown for the area type to be created
            createNew: function(){      //Button to create a new area
                changeMouseMode(mouseMode.areaDef);   //Set the mouse mode to area creation
                resetOutline();
            },
            continueArea: function(){
                changeMouseMode(mouseMode.areaDef);
            },
            finishArea: function(){
                finalOutline();
            },
            clearAreas: function(){
                clearAreas();
            }
        },
        objects:{       //Stores all the placable objects
            place: function(){      //Button to place objects
                changeMouseMode(mouseMode.objectPlace);   //Changes mouse mode accordingly
            },
            remove: function(){     //Button to remove objects
                changeMouseMode(mouseMode.objectRemove);
            },
            move: function(){       //Button to move objects
                changeMouseMode(mouseMode.objectMove);
            },
            trees:{     //Stores all the tree variations 
                tree1: function(){
                    currentObject = placableObjects.trees.tree1;    //Changes the current placeable objecgt accordingly
                    updateCurrentObjectPath();
                },
                tree2: function(){
                    currentObject = placableObjects.trees.tree2;
                    updateCurrentObjectPath();
                },
                tree3: function(){
                    currentObject = placableObjects.trees.tree3;
                    updateCurrentObjectPath();
                }
            },
            flowers:{
                pot: function(){
                    currentObject = placableObjects.flowers.pot;
                    updateCurrentObjectPath();
                },
                redFlower: function(){
                    currentObject = placableObjects.flowers.redFlower;
                    updateCurrentObjectPath();
                },
                whiteFlower: function(){
                    currentObject = placableObjects.flowers.whiteFlower;
                    updateCurrentObjectPath();
                },
                sunflower: function(){
                    currentObject = placableObjects.flowers.sunflower;
                    updateCurrentObjectPath();
                }
            },
            bushes:{
                bush1: function()
                {
                    currentObject = placableObjects.bushes.bush1;
                    updateCurrentObjectPath();
                },
                bush2: function()
                {
                    currentObject = placableObjects.bushes.bush2;
                    updateCurrentObjectPath();
                },
                bush3: function()
                {
                    currentObject = placableObjects.bushes.bush3;
                    updateCurrentObjectPath();
                }
            },
            furniture:{  //Stores all the furniture variations
                benches:{
                    bench1: function(){
                        currentObject = placableObjects.furniture.benches.bench1;
                        updateCurrentObjectPath();
                    },
                    bench2: function(){
                        currentObject = placableObjects.furniture.benches.bench2;
                        updateCurrentObjectPath();
                    },
                    bench3: function(){
                        currentObject = placableObjects.furniture.benches.bench3;
                        updateCurrentObjectPath();
                    }
                },
                chairs:{
                    chair1: function(){
                        currentObject = placableObjects.furniture.chairs.chair1;
                        updateCurrentObjectPath();
                    }
                },
                tables:{
                    table1: function(){
                        currentObject = placableObjects.furniture.tables.table1;
                        updateCurrentObjectPath();
                    }
                }
            }
        }
    }

    //#region GUI folders
    const planeFolder = gui.addFolder("Plane");     //Plane folder created
    planeFolder.add(world.plane, "width", 10, 300, 10).name("Width"). //Add width slider
        onChange(() => {
            planeMesh.geometry.dispose();           //Remove old plane geo
            planeMesh.geometry = new THREE.BoxGeometry(world.plane.width, 1, world.plane.height);    //Create new plane geo with slider dimensions
            
            gridMesh.geometry.dispose();
            gridTexture.repeat.set(world.plane.width/10, world.plane.height/10);
            gridMesh.geometry = new THREE.PlaneGeometry(world.plane.width, world.plane.height);
            gridMesh.geometry.rotateX(- Math.PI / 2);

        });
    planeFolder.add(world.plane, "height", 10, 300, 10).name("Height").    //Same with height
        onChange(() => {
            planeMesh.geometry.dispose();
            planeMesh.geometry = new THREE.BoxGeometry(world.plane.width, 1, world.plane.height);

            gridMesh.geometry.dispose();
            gridTexture.repeat.set(world.plane.width/10, world.plane.height/10);
            gridMesh.geometry = new THREE.PlaneGeometry(world.plane.width, world.plane.height);
            gridMesh.geometry.rotateX(- Math.PI / 2);
        });
    planeFolder.add(world.plane, "type").options(areaTypes).name("Terrain type").   //Terrain type selector
    onChange(()=>{
        objects.length = 0; //Clears the objects array
        //console.log(objects);
        scene.remove(planeMesh);    //deletes the old mesh

        //reset size sliders to 100

        switch(world.plane.type)    //generates a new mesh with the selected material
        {
            case areaTypes.grass:
                planeMesh = new THREE.Mesh(planeGeo, grassMaterial);
                planeMesh.recieveShadow = true;
                planeMesh.name = "plane";
                scene.add(planeMesh);
                objects.push(planeMesh);
                break;
            case areaTypes.soil:
                planeMesh = new THREE.Mesh(planeGeo, soilMaterial);
                planeMesh.recieveShadow = true;
                planeMesh.name = "plane";
                scene.add(planeMesh);
                objects.push(planeMesh);
                break;
            case areaTypes.gravel:
                planeMesh = new THREE.Mesh(planeGeo, gravelMaterial);
                planeMesh.recieveShadow = true;
                planeMesh.name = "plane";
                scene.add(planeMesh);
                objects.push(planeMesh);
                break;
            case areaTypes.stone:
                planeMesh = new THREE.Mesh(planeGeo, stoneMaterial);
                planeMesh.recieveShadow = true;
                planeMesh.name = "plane";
                scene.add(planeMesh);
                objects.push(planeMesh);
                break;
        }
    });
    planeFolder.add(world.plane, "grid").name("Enable grid").onChange(()=>{
        gridMesh.visible = world.plane.grid;
    })
    planeFolder.add(world.plane, "snapToGrid").name("Snap to grid");
    planeFolder.add(world.plane, "finalPlane").name("Finalise plane");  //Button to finalise plane. Removes plane folder
    planeFolder.open();

    const areaFolder = gui.addFolder("Area");       //Area folder added
    areaFolder.add(world.area, "type").options(areaTypes).name("Terrain type");  //Add area type dropdown selector
    areaFolder.add(world.area, "createNew").name("New area (Q)");       //Add new area button
    areaFolder.add(world.area, "continueArea").name("Continue Area (W)");
    areaFolder.add(world.area,"finishArea").name("Finish area (E)");    //add finish area button
    areaFolder.add(world.area, "clearAreas").name("Clear areas (R)");
    //areaFolder.open();

    const objectFolder = gui.addFolder("Objects");              //Add the objects folder
    objectFolder.add(world.objects, "place").name("Place (A)");     //Add place, remove, move buttons
    objectFolder.add(world.objects, "remove").name("Remove (S)");
    objectFolder.add(world.objects, "move").name("Move (D)");

    const treeFolder = objectFolder.addFolder("Trees");         //Add tree folder to the objects folder
    treeFolder.add(world.objects.trees, "tree1").name("Tree 1");
    treeFolder.add(world.objects.trees, "tree2").name("Tree 2");

    const flowerFolder = objectFolder.addFolder("Flowers");
    flowerFolder.add(world.objects.flowers, "pot").name("Flower pot");
    flowerFolder.add(world.objects.flowers, "redFlower").name("Red flower");
    flowerFolder.add(world.objects.flowers, "whiteFlower").name("White flower");
    flowerFolder.add(world.objects.flowers, "sunflower").name("Sunflower");

    const bushFolder = objectFolder.addFolder("Bushes");
    bushFolder.add(world.objects.bushes, "bush1").name("Bush 1");
    bushFolder.add(world.objects.bushes, "bush2").name("Bush 2");
    bushFolder.add(world.objects.bushes, "bush3").name("Bush 3");

    const furnitureFolder = objectFolder.addFolder("Furniture");
    furnitureFolder.add(world.objects.furniture.benches, "bench1").name("Bench 1");
    furnitureFolder.add(world.objects.furniture.chairs, "chair1").name("Chair 1");
    furnitureFolder.add(world.objects.furniture.tables, "table1").name("Table 1");

    //objectFolder.open();

    //#endregion GUI folders

    //#endregion GUI

    //#region camera controls

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000); //Create the main camera
    camera.position.set(50, 80, 130);   //Set the initial position
    camera.lookAt(0, 0, 0);             //Make the camera look at the origin (position of the plane)

    controls = new OrbitControls(camera, renderer.domElement);  //Create the camera orbit controls

    controls.listenToKeyEvents(window); // optional

    controls.keyPanSpeed = 0;       //Disables key panning but allows panning with middle mouse
    controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 10;      //Min and max zoom distances
    controls.maxDistance = 1500;
    //controls.maxPolarAngle = Math.PI / 2.3;     //Restricts the cameras vertical rotation so you cant see under the plane

    controls.mouseButtons = {
        MIDDLE: THREE.MOUSE.PAN,  //Changed controls because left mouse is used for manipulating objects
        RIGHT: THREE.MOUSE.ROTATE
    }
    //#endregion camera controls

    //#region Rollovers

    //////roll-over sphere/////

    const rollOverGeo = new THREE.SphereGeometry(1, 32, 32);
    rollOverMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, opacity: 0.5, transparent: true });
    rollOverMesh = new THREE.Mesh(rollOverGeo, rollOverMaterial);
    rollOverMesh.name = "Rollover";
    scene.add(rollOverMesh);

    objectRolloverMaterial = new THREE.MeshBasicMaterial({opacity: 0.5, transparent: true});

    //#endregion Rollovers

    //#region raycast

    raycaster = new THREE.Raycaster();
    pointer = new THREE.Vector2();

    //#endregion raycast

    //#region plane & grid

    planeGeo = new THREE.BoxGeometry(100, 1, 100);
    //planeGeo.rotateX(- Math.PI / 2);

    
    planeMesh = new THREE.Mesh(planeGeo, grassMaterial);
    planeMesh.castShadow = false;
    planeMesh.receiveShadow = true;
    planeMesh.name = "plane";
    scene.add(planeMesh);
    
    objects.push(planeMesh);

    gridGeo = new THREE.PlaneGeometry(100,100);

    gridMesh = new THREE.Mesh(gridGeo, gridMaterial);
    gridGeo.rotateX(- Math.PI / 2);
    gridMesh.position.set(gridMesh.position.x,gridMesh.position.y +0.555,gridMesh.position.z);
    scene.add(gridMesh);

    //#endregion plane & grid

    //#region listeners

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onDocumentKeyDown);
    document.addEventListener('keyup', onDocumentKeyUp);
    window.addEventListener('resize', onWindowResize);

    //gui.document.addEventListener('pointerdown', function() { currentMouseMode = mouseMode.default;}, false);
    //#endregion listeners

    //#region assignments and loaders

    outlineFinished = false;
    nodeID = 0;
    areaID = 0;
    objectID = 0;
    areaHeightOffset = 0;
    isMoving = false;
    gridSnapFactor = 5;

    currentObject = placableObjects.trees.tree1;
    updateCurrentObjectPath();
    changeMouseMode(mouseMode.none);
    currentScale = 10;
    currentRotation = 0;
    
    loadAudio();
 

    //#endregion assignments and loaders

function updateCurrentObjectPath(){
    switch(currentObject)
    {
        /////Trees/////
        case placableObjects.trees.tree1:
            currentObjectPath = 'models/trees/tree1.gltf';
            break;
        case placableObjects.trees.tree2:
            currentObjectPath = 'models/trees/tree2.gltf';
            break;
        case placableObjects.trees.tree3:
            currentObjectPath = 'models/trees/tree3.gltf';
            break;
        /////Flowers/////
        case placableObjects.flowers.pot:
            currentObjectPath = 'models/flowers/empty pot.gltf';
            break;
        case placableObjects.flowers.whiteFlower:
            currentObjectPath = 'models/flowers/whiteFlower.gltf';
            break;
        case placableObjects.flowers.redFlower:
            currentObjectPath = 'models/flowers/redFlower.gltf';
            break;
        case placableObjects.flowers.sunflower:
            currentObjectPath = 'models/flowers/sunflower.gltf';
            break;
        /////Bushes/////
        case placableObjects.bushes.bush1:
            currentObjectPath = 'models/bushes/bush1.gltf';
            break;
        case placableObjects.bushes.bush2:
            currentObjectPath = 'models/bushes/bush2.gltf';
            break;
        case placableObjects.bushes.bush3:
            currentObjectPath = 'models/bushes/bush3.gltf';
            break;
        /////furniture/////
        case placableObjects.furniture.benches.bench1:
            currentObjectPath = 'models/furniture/bench1.gltf';
            break;
        case placableObjects.furniture.chairs.chair1:
            currentObjectPath = 'models/furniture/chair1.gltf';
            break;
        case placableObjects.furniture.tables.table1:
            currentObjectPath = 'models/furniture/table1.gltf';
            break;
    }

    changeMouseMode(mouseMode.objectPlace);
    console.log("Current object updated to: " + currentObject);
    loadRollover();
}

function loadAudio(){
    listener = new THREE.AudioListener();
    camera.add(listener);

    spawnSound = new THREE.Audio(listener);
    spawnSound.name = "SpawnListener";
    scene.add(spawnSound);

    new THREE.AudioLoader().load('sounds/pop.wav', function (audioBuffer){
        spawnSound.setBuffer(audioBuffer);
        //sound.play();
    });

    deleteSound = new THREE.Audio(listener);
    deleteSound.name = "DeleteListener";
    scene.add(deleteSound);

    new THREE.AudioLoader().load('sounds/click1.wav', function (audioBuffer){
        deleteSound.setBuffer(audioBuffer);
    });
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

    gridTexture = new THREE.TextureLoader().load("textures/grid.png");
    gridTexture.wrapS = THREE.RepeatWrapping;
    gridTexture.wrapT = THREE.RepeatWrapping;
    gridTexture.repeat.set(20, 20);

    gridMaterial = new THREE.MeshPhongMaterial({
        color: 0xdddddd,
        map: gridTexture,
        transparent: true
    })

    /////Other mats/////


    outlineMaterial = new THREE.LineBasicMaterial({ color: 0xfffffff });    //White, used for lines between area points

}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onPointerMove(event) {

    pointer.set((event.clientX / window.innerWidth) * 2 - 1, - (event.clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(objects); //objects[] contains the plane

    if (intersects.length > 0) {

        const intersect = intersects[0];    //intersects[] contains the intersection data

        switch(currentMouseMode)    //Switch for mouse modes
        {
            case mouseMode.areaDef:
                rollOverMesh.visible = true;
                rollOverMesh.position.copy(intersect.point).add(intersect.face.normal);
                break;
            case mouseMode.objectPlace:
                rollOverMesh.visible = false;
                objectRolloverMesh.visible = true;

                objectRolloverMesh.position.copy(intersect.point).add(intersect.face.normal);
                if(world.plane.snapToGrid) objectRolloverMesh.position.divideScalar( gridSnapFactor/4 ).floor().multiplyScalar( gridSnapFactor/4 ).addScalar( gridSnapFactor/8 );
                objectRolloverMesh.scale.set(currentScale,currentScale,currentScale);  //Set scale
                objectRolloverMesh.rotation.y = THREE.Math.degToRad(currentRotation);  //Set rotation
                
                break;
            case mouseMode.objectRemove:
                objectRolloverMesh.visible = false;
                break;
            case mouseMode.objectMove:
                objectRolloverMesh.visible = false;

                break;
        }
    }
    else{
        if(rollOverMesh != null) rollOverMesh.visible = false;      //Removes the rollover mesh when the pointer isnt in a valid position
        if(objectRolloverMesh != null) objectRolloverMesh.visible = false;
    }
}

function onPointerDown(event) {

    switch(currentMouseMode)    //Master switch for mouse mode
    {
        case mouseMode.areaDef:         //Area definition mode
            
            switch (event.which){   ////Mouse button switch 
                case 1: //Left click area definition

                if (!outlineFinished) {

                    pointer.set((event.clientX / window.innerWidth) * 2 - 1, - (event.clientY / window.innerHeight) * 2 + 1);
                    raycaster.setFromCamera(pointer, camera);
                    const intersects = raycaster.intersectObjects(objects);
    
                    if (intersects.length > 0) {    //If ray intersects with something
    
                        const intersect = intersects[0];
                        if (objects.includes(intersect.object)){    //if intersect is included in the objects array
                            let node;   //temp variable to store the gltf.scene object
    
                            new GLTFLoader().load('models/markerpost.gltf', function(gltf){ //gltf loader loads marker post model
                                node = gltf.scene;      //gltf model assigned to node object
                                node.castShadow = true;
                                node.scale.set(13,13,13);       //Increase scale
                                node.position.copy(intersect.point).add(intersect.face.normal); //Set position to the intersect
                                scene.add(node);        //Add the node to the scene
    
                                node.name = "node " + nodeID;   //Give the node a name with the id
                                nodeID++;       //increment id 
                                nodes.push(node);               //Push node to the array of nodes
                                console.log("Pushed node:" + node.name);
        
                                const pos = node.position;     //temp variable to store the point
                                outlinePoints.push(new THREE.Vector3(pos.x, pos.y, pos.z)); //Push a new point to the outline points array
                                console.log("Added point at x:" + pos.x.toFixed(2) + "  y:" + pos.y.toFixed(2) + "  z:" + pos.x.toFixed(2));
    
                                if (outlinePoints.length > 1) { //if there is more than one point, draw a line between them
                                    drawLine();
                                }
        
                                if (outlinePoints.length == 4) {    //Finishes the outline on four points
                                    finalOutline();
                                }
                            });
                        }
                    }
                }
                    break;
                case 2: //Middle click area definition
                    break;
                case 3: //right click area definition
                    break;
            }
            
        break;
        case mouseMode.objectPlace:     //Object placing mode

        switch (event.which){   ////Mouse button switch 
            case 1: //Left click object place

                pointer.set((event.clientX / window.innerWidth) * 2 - 1, - (event.clientY / window.innerHeight) * 2 + 1);
                raycaster.setFromCamera(pointer, camera);
                const intersects = raycaster.intersectObjects(objects); //objects[] contains the plane

                if (intersects.length > 0) {    //If ray intersects with something

                    const intersect = intersects[0];
                    if (objects.includes(intersect.object)){    //if intersect is included in the objects array
                        let placableObject;   //temp variable to store the gltf.scene object

                        new GLTFLoader().load(currentObjectPath, function(gltf){ //gltf loader loads the current selected model
                            placableObject = gltf.scene;      //gltf model assigned to temp variable
                            placableObject.traverse(n =>{       //Sets all the meshes in the object to cast and recieve shadows
                                if(n.isMesh){
                                    n.castShadow = true;
                                    n.receiveShadow = true;
                                }
                            })
                            placableObject.position.copy(intersect.point).add(intersect.face.normal); //Set position to the intersect
                            placableObject.position.set(placableObject.position.x, placableObject.position.y -1, placableObject.position.z);    //Offset so objects aren't floating
                            //placableObject.position.set(placableObject.position.x, placableObject.position.y -1, placableObject.position.z);    //Offset so objects aren't floating

                            if(world.plane.snapToGrid) placableObject.position.divideScalar( gridSnapFactor/4 ).floor().multiplyScalar( gridSnapFactor/4 ).addScalar( gridSnapFactor/8 );
                            placableObject.scale.set(currentScale,currentScale,currentScale);  //Set scale
                            placableObject.rotation.y = THREE.Math.degToRad(currentRotation);  //Set rotation
                            scene.add(placableObject);        //Add the object to the scene

                            placableObject.name = currentObject;
                            objectID++;       //increment object id 
                            placedObjects.push(placableObject);               //Push object to the array of nodes
                            console.log("Pushed object:" + placableObject.name);

                            spawnSound.play();

                        });
                    }
                    if(isMoving) {
                        changeMouseMode(mouseMode.none); 
                        isMoving = false;
                    }
                }
                break;
            case 2: //Middle click
                break;
            case 3: //right click
                break;
        }

            break;
        case mouseMode.objectRemove:    //Object removing mode

        switch (event.which){   ////Mouse button switch 
            case 1: //Left click

                pointer.set((event.clientX / window.innerWidth) * 2 - 1, - (event.clientY / window.innerHeight) * 2 + 1);
                raycaster.setFromCamera(pointer, camera);

                const intersects = raycaster.intersectObjects(placedObjects, true); //placedObjects[] contains all placable objects
                                                                                    //true parameter makes it search recursively through the objects children
                if (intersects.length > 0) {    //If ray intersects with something

                    const intersect = intersects[0];
                    const parentId = intersect.object.parent.parent.id;

                    intersect.object.parent.traverse(n =>{
                        scene.remove(n);
                    })

                    scene.remove(scene.getObjectById(parentId));  //Removes the parent of the object 
                    console.log("Removed object: "+parentId);

                    const index = placedObjects.indexOf(intersect.object.parent);   //Removes the object from the array
                    if(index > -1) placedObjects.splice(index,1);
                    deleteSound.play();
                }
                break;
            case 2: //Middle click
                break;
            case 3: //right click
                break;
        }
        break;
        case mouseMode.objectMove:      //Object moving mode

        switch (event.which){   ////Mouse button switch 
            case 1: //Left click

                pointer.set((event.clientX / window.innerWidth) * 2 - 1, - (event.clientY / window.innerHeight) * 2 + 1);
                raycaster.setFromCamera(pointer, camera);

                const intersects = raycaster.intersectObjects(placedObjects, true); //placedObjects[] contains all placable objects
                                                                                    //true parameter makes it search recursively through the objects children
                if (intersects.length > 0) {    //If ray intersects with something

                    const intersect = intersects[0];
                    const parentId = intersect.object.parent.parent.id;
                    currentObject = intersect.object.parent.parent.name;

                    intersect.object.parent.traverse(n =>{
                        scene.remove(n);
                    })

                    scene.remove(scene.getObjectById(parentId));  //Removes the parent of the object 
                    console.log("Removed object: "+parentId);

                    const index = placedObjects.indexOf(intersect.object.parent);   //Removes the object from the array
                    if(index > -1) placedObjects.splice(index,1);
                    deleteSound.play();
                    ////Removed the object, get the object and set to place mode


                    changeMouseMode(mouseMode.objectPlace);
                    isMoving = true;
                }

                break;
            case 2: //Middle click
                break;
            case 3: //right click
                break;
        }

            break;
    }
}

function onDocumentKeyDown(event) {

    switch (event.keyCode) {
        /////Arrow keys//////
        case 38:    //Arrow up - scale up
            currentScale += 0.5; 
            console.log("Scale changed to: " + currentScale);
            break; 
        case 40:    //Arrow down - scale down
            currentScale -= 0.5; 
            if(currentScale < 0 ) currentScale = 0.5;
            console.log("Scale changed to: " + currentScale);
            break; 
        case 37:  //Arrow left - -rotation
            currentRotation -= 5;
            if(currentRotation <0 ) currentRotation = 360;  //Loops rotation 
            console.log("Rotation changed to: " + currentRotation);
            break; 
        case 39:  //Arrow right - +rotation
            currentRotation += 5;
            if(currentRotation > 360 ) currentRotation = 0;
            console.log("Rotation changed to: " + currentRotation);
            break; 

        /////Macros/////
        case 81: //q - new area
            changeMouseMode(mouseMode.areaDef);
            break;
        case 87: //w - continue area
            break;
        case 69: //e - finish area
            finalOutline();
            break;
        case 82: //r - clear areas
            clearAreas();
            break;
        case 65: //a - place obj
            changeMouseMode(mouseMode.objectPlace);
            break;
        case 83: //s - remove obj 
            changeMouseMode(mouseMode.objectRemove);
            break;
        case 68: //d - move obj
        changeMouseMode(mouseMode.objectMove);
            break;
    }

    objectRolloverMesh.scale.set(currentScale,currentScale,currentScale);  //Set scale
    objectRolloverMesh.rotation.y = THREE.Math.degToRad(currentRotation);  //Set rotation
}

function onDocumentKeyUp(event) {

    switch (event.keyCode) {
        case 16: isShiftDown = false; break;    //shift
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
    if (outlinePoints.length > 2) { //If it is a triangle or more (>2 points)
        console.log("Final outline");
        outlinePoints.push(new THREE.Vector3(outlinePoints[0].x, outlinePoints[0].y, outlinePoints[0].z)); //Add a duplicate of the first point to the end of the array to make it a complete area
        drawLine();
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
        areaMesh.name = "area " + areaID;    //Gives the area a name and id
        areaID++;   //increment id
        areas.push(areaMesh);
        scene.add(areaMesh);    //Add mesh to the scene
        areaMesh.position.y -= 0.95 - areaHeightOffset; //Makes the area level (just above) the plane
        areaHeightOffset += 0.005;  //Height offset is increased slightly each area generated to avoid z fighting

        console.log(areas);

        changeMouseMode(mouseMode.none);

        for(let i in nodes)
        {
            console.log("Removed element: " + i.toString());
            scene.remove(scene.getObjectByName("node "+i));
        }
    }
    nodeID = 0; //Reset the node id counter so the next set of nodes can be deleted
    scene.remove(scene.getObjectByName("outline"));
}

function resetOutline() {       //Clears nodes and outline points ready for a new area
    for (let i in nodes) {
        scene.remove(nodes[i].object);
        console.log("Removed element: " + i.toString());
        scene.remove(scene.getObjectByName("node "+i));
    }
    nodes.length = 0;
    outlinePoints.length = 0;

    outlineFinished = false;
}

function clearAreas(){
    for(let i in areas)
    {
        scene.remove(scene.getObjectByName("area "+i));
    }
    areas.length = 0;
    console.log(areas);
    areaID = 0;
}

function loadRollover()
{
    new GLTFLoader().load(currentObjectPath, function(gltf){
        objectRolloverMesh = gltf.scene;
        objectRolloverMesh.traverse(function(child){
            if(child instanceof THREE.Mesh) { child.material = objectRolloverMaterial; } //Makes the object transparent
        });
        scene.add(objectRolloverMesh);
    });
}

function changeMouseMode(mode)
{
    switch(mode)
    {
        case mouseMode.none:
            currentMouseMode = mouseMode.none;
            rollOverMesh.visible = false;
            break;
        case mouseMode.areaDef:
            currentMouseMode = mouseMode.areaDef;
            rollOverMesh.visible = true;
            break;
        case mouseMode.objectPlace:
            currentMouseMode = mouseMode.objectPlace;
            rollOverMesh.visible = false;
            break;
        case mouseMode.objectRemove:
            currentMouseMode = mouseMode.objectRemove;
            rollOverMesh.visible = false;
            break;
        case mouseMode.objectMove:
            currentMouseMode = mouseMode.objectMove;
            rollOverMesh.visible = false;
            break;
    }
}}