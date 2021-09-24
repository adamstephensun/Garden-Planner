import * as THREE from "https://unpkg.com/three@0.126.1/build/three.module.js";

import { OrbitControls } from "https://unpkg.com/three@0.126.1/examples/jsm/controls/OrbitControls.js";
import { ConvexGeometry } from "https://unpkg.com/three@0.126.1/examples/jsm/geometries/ConvexGeometry.js";
import { GUI } from "https://unpkg.com/three@0.126.1/examples/jsm/libs/dat.gui.module.js";
import { GLTFLoader } from "https://unpkg.com/three@0.126.1/examples/jsm/loaders/GLTFLoader.js";
import { GLTFExporter } from "https://unpkg.com/three@0.126.1/examples/jsm/exporters/GLTFExporter.js";
import { PointerLockControls } from "https://unpkg.com/three@0.126.1/examples/jsm/controls/PointerLockControls.js"; 

//#region declarations
let camera, listener, scene, renderer, controls, gui, world;
let hemiLight, sunLight, moonLight, ambiLight;
let sunPosition,sunGeometry, sunTexture, sunMaterial, sunSphere, moonTexture, moonMaterial, moonSphere, timestamp, clock;
let planeMesh, planeSelectorGeo, planeID, currentPlaneMat, currentGridpos, selectedSection;
let pointer, raycaster;
let markerSound, spawnSound, deleteSound;
let dragGeo, dragMeshX, dragMeshZ;
let dragFlag, planeScale, mouseDeltaX, mouseDeltaY, lastMouseX, lastMouseY, currentDragX, maxPlaneScale, minPlaneScale;

let grassTexture, grassNormal, soilTexture, soilNormal, gravelTexture, gravelNormal, stoneTexture, stoneNormal, gridTexture;
let grassMaterial, soilMaterial, gravelMaterial, stoneMaterial, gridMaterial;
let starTexture, skyColour;

let flagRollOverMesh, flagRollOverMaterial;
let objectRolloverMesh, objectRolloverMaterial, objectRolloverActive;
let nodeID;
let outlineGeo, outlineMaterial;
let gridGeo, gridMesh, gridSnapFactor, gridSquareGeo, gridSquareMat, gridSquareNum, gridSquareID;
let areaGeo, areaID, areaHeightOffset, planeGeo;
let outlineFinished, exportSuccess, canInteract, helpActive = new Boolean;

let prevTime, fpRaycaster;
let isFirstPerson, moveForward, moveBackward, moveLeft, moveRight, canJump = new Boolean;
let velocity, direction;

let exporter, link, confirmExport, confirmExportTimer, filenameInput, infoBox;
let helpButton, helpBox, helpBack, helpForward, helpPage, helpH2, helpP; 
let toggleCamButton, controlsBox1, controlsBox2, crosshair, fpControls, notif, notifFlag, planeChangeTimer, posPopup;

let timer, sunStartPos, days;
let dayFlag = new Boolean;

const collisionObjects = [];
const nodes = [];
const areas = [];
const outlinePoints = [];
const placedObjects = [];
const planeSelectors = [];
const dragables = [];
const gridSections = [];

const areaTypes = { grass: 'Grass', soil: 'Soil', gravel: 'Gravel', stone: 'Stone' };

const placableObjects = {
    trees:{
        tree1: "Tree 1", tree2: "Tree 2", tree3: "Tree 3"
    },
    plants:{
        tomato: "Tomato", strawberry: "Strawberry", cucumber: "Cucumber", lettuce: "Lettuce", carrot: "Carrot"
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
    },
    beds:{
        squareRaised: "Square raised", rectRaised: "Rectangle raised", triangleRaised: "Triangle raised"
    },
    walls:{
        fenceLow: "Low fence", fenceHigh: "High fence", brickLow: "Low Brick", brickHigh: "High brick", stoneLow: "Low stone", stoneHigh: "High stone"
    },
    leisure:{
        bbq: "BBQ", firepit: "Firepit", swing: "Swing", goal: "Goal", sandbox: "Sandbox"
    }
}

const mouseMode = {
    none: "None",
    areaDef: "Area definition",
    objectPlace: "Object place",
    objectRemove: "Object remove",
    objectMove: "Object move",
}

let currentMouseMode = mouseMode.areaDef;

let currentObject, currentObjectPath, isMoving, currentObjectScale, currentObjectRotation, currentObjectPosition;
let upArrowDown, downArrowDown, rightArrowDown, leftArrowDown;
let dragCountX, dragCountZ;

//#endregion declarations

init();

function init() {

    //#region renderer and scene setup

    scene = new THREE.Scene();
    scene.background = skyColour;
    scene.name = "Garden-Planner-scene1";
    //scene.fog = new THREE.Fog(0xFFFFFF, 10, 300);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    document.body.appendChild(renderer.domElement);

    /*labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0px';
    document.body.appendChild(labelRenderer.domElement);*/

    loadTextures();

    //#endregion renderer and scene setup

    //#region lights

    hemiLight = new THREE.HemisphereLight(0xfdfbd3 , 0x34ad61, 0.4);
    scene.add(hemiLight);

    ambiLight = new THREE.AmbientLight(0xffa95c);
    scene.add(ambiLight);
    ambiLight.visible = false;

    sunLight = new THREE.SpotLight(0xffa95c,1);
    sunLight.castShadow = true;
    sunLight.shadow.bias = -0.0001;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 500;

    moonLight = new THREE.SpotLight(0xffffff,0.2);
    moonLight.castShadow = true;
    moonLight.shadow.bias = -0.0001;
    moonLight.shadow.mapSize.width = 2048;
    moonLight.shadow.mapSize.height = 2048;
    moonLight.shadow.camera.near = 0.5;
    moonLight.shadow.camera.far = 500;

    scene.add(sunLight);
    scene.add(moonLight);

    sunPosition = new THREE.Object3D;

    sunGeometry = new THREE.SphereGeometry( 5, 32, 32 );
    sunSphere = new THREE.Mesh( sunGeometry, sunMaterial );
    
    moonSphere = new THREE.Mesh(sunGeometry, moonMaterial);

    scene.add(sunSphere);
    scene.add(moonSphere);

    //#endregion lights

    //#region GUI

    gui = new GUI();    //create the gui

    gui.width = 300;
    

    world = {   //World variables
        plane: {            //Controls for the plane
            width: 100,     //change width
            height: 100,    //change height
            type: "Grass",
            grid: true,
            snapToGrid: true,
        },
        area: {     //Controls for area creation
            type: "Grass",          //Dropdown for the area type to be created
            createNew: function(){      //Button to create a new area
                changeMouseMode(mouseMode.areaDef);   //Set the mouse mode to area creation
            },
            finishArea: function(){
                finalOutline();
            },
            clearAreas: function(){
                clearAreas();
            }
        },
        lights:{
            timeScale: 3,
            orbitRadius: 150,
            sunCycleActive: true,
            flatLighting: false
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
            plants:{
                tomato: function(){
                    currentObject = placableObjects.plants.tomato;
                    updateCurrentObjectPath();
                },
                strawberry: function(){
                    currentObject = placableObjects.plants.strawberry;
                    updateCurrentObjectPath();
                },
                cucumber: function(){
                    currentObject = placableObjects.plants.cucumber;
                    updateCurrentObjectPath();
                },
                lettuce: function(){
                    currentObject = placableObjects.plants.lettuce;
                    updateCurrentObjectPath();
                },
                carrot: function(){
                    currentObject = placableObjects.plants.carrot;
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
                bush1: function(){
                    currentObject = placableObjects.bushes.bush1;
                    updateCurrentObjectPath();
                },
                bush2: function(){
                    currentObject = placableObjects.bushes.bush2;
                    updateCurrentObjectPath();
                },
                bush3: function(){
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
            },
            beds:{
                squareRaised: function(){
                    currentObject = placableObjects.beds.squareRaised;
                    updateCurrentObjectPath();
                },
                rectRaised: function(){
                    currentObject = placableObjects.beds.rectRaised;
                    updateCurrentObjectPath();
                },
                triangleRaised: function(){
                    currentObject = placableObjects.beds.triangleRaised;
                    updateCurrentObjectPath();
                }
            },
            walls:{
                fenceLow: function(){
                    currentObject = placableObjects.walls.fenceLow;
                    updateCurrentObjectPath();
                },
                fenceHigh: function(){
                    currentObject = placableObjects.walls.fenceHigh;
                    updateCurrentObjectPath();
                },
                brickLow: function(){
                    currentObject = placableObjects.walls.brickLow;
                    updateCurrentObjectPath();
                },
                brickHigh: function(){
                    currentObject = placableObjects.walls.brickHigh;
                    updateCurrentObjectPath();
                },
                stoneLow: function(){
                    currentObject = placableObjects.walls.stoneLow;
                    updateCurrentObjectPath();
                },
                stoneHigh: function(){
                    currentObject = placableObjects.walls.stoneHigh;
                    updateCurrentObjectPath();
                },
            },
            leisure:{
                bbq: function(){
                    currentObject = placableObjects.leisure.bbq;
                    updateCurrentObjectPath();
                },
                firepit: function(){
                    currentObject = placableObjects.leisure.firepit;
                    updateCurrentObjectPath();
                },
                swing: function(){
                    currentObject = placableObjects.leisure.swing;
                    updateCurrentObjectPath();
                },
                goal: function(){
                    currentObject = placableObjects.leisure.goal;
                    updateCurrentObjectPath();
                },
                sandbox: function(){
                    currentObject = placableObjects.leisure.sandbox;
                    updateCurrentObjectPath();
                }
            }
        }
    }

    //#region GUI folders
    const planeFolder = gui.addFolder("Plane");     //Plane folder created
    planeFolder.add(world.plane, "type").options(areaTypes).name("Terrain type").   //Terrain type selector
    onChange(()=>{

        scene.remove(planeMesh);    //deletes the old mesh

        //reset size sliders to 100
        planeGeo = new THREE.BoxGeometry(world.plane.width, 1, world.plane.height);

        switch(world.plane.type)    //generates a new mesh with the selected material
        {
            case areaTypes.grass:
                currentPlaneMat = grassMaterial;
                createPlane(new THREE.Vector3());
                break;
            case areaTypes.soil:
                currentPlaneMat = soilMaterial;
                createPlane(new THREE.Vector3());
                break;
            case areaTypes.gravel:
                currentPlaneMat = gravelMaterial;
                createPlane(new THREE.Vector3());
                break;
            case areaTypes.stone:
                currentPlaneMat = stoneMaterial;
                createPlane(new THREE.Vector3());
                break;
        }
        collisionObjects.push(planeMesh);
    });
    planeFolder.add(world.plane, "grid").name("Enable grid").onChange(()=>{ 
        gridSections.forEach(element => {
            element.visible = world.plane.grid;
        });

        notifFlag = true;
        if(world.plane.grid) notif.innerHTML = "Grid enabled";
        else notif.innerHTML = "Grid disabled";
     })
    planeFolder.add(world.plane, "snapToGrid").name("Snap to grid").onChange(()=>{
        notifFlag = true;
        if(world.plane.snapToGrid) notif.innerHTML = "Grid snapping enabled";
        else notif.innerHTML = "Grid snapping disabled";
    });
    planeFolder.open();

    addRestOfGUI();

    //#endregion GUI folders

    //#endregion GUI

    //#region raycast

    raycaster = new THREE.Raycaster();
    pointer = new THREE.Vector2();

    //#endregion raycast

    //#region drag

    dragGeo = new THREE.SphereGeometry(1,32,16);

    //#endregion drag

    //#region plane & grid
    
    planeGeo = new THREE.BoxGeometry(world.plane.width, 1, world.plane.height);
    planeSelectorGeo = new THREE.PlaneGeometry(world.plane.width, world.plane.height);
    gridGeo = new THREE.PlaneGeometry(world.plane.width,world.plane.height);

    gridSquareNum = 10;
    gridSquareID = 0;
    notifFlag = false;

    gridSquareGeo = new THREE.PlaneGeometry((world.plane.width / gridSquareNum) / 2, (world.plane.height / gridSquareNum) / 2);
    gridSquareGeo.rotateX(-Math.PI / 2);

    selectedSection = new THREE.Object3D();

    currentPlaneMat = grassMaterial;

    planeID = 0;
    planeScale = new THREE.Vector3(1,1,1);

    //////Plane change notif//////
    notif = document.getElementById("notif");
    notif.style.visibility = 'hidden';

    createPlane(new THREE.Vector3());

    //planeMesh.add(gridMesh);  

    //#endregion plane & grid

    //#region listeners

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('keydown', onDocumentKeyDown);
    document.addEventListener('keyup', onDocumentKeyUp);
    window.addEventListener('resize', onWindowResize);

    //gui.document.addEventListener('pointerdown', function() { currentMouseMode = mouseMode.default;}, false);
    //#endregion listeners

    //#region assignments and loaders

    ////////Assignments////////
    outlineFinished = false;    //For area creation
    nodeID = 0;                 //Area creation
    areaID = 0;                 //Area creation
    areaHeightOffset = 0;       //Area creation
    isMoving = false;           //Flag for moving placableobject
    gridSnapFactor = 5;         //Factor for size of grid snapping
    confirmExportTimer = 0;     //Timer for export confirm html message
    planeChangeTimer= 0;
    canInteract = true;         //Bool to determine if the player can interact with the js scene
    objectRolloverActive = false;
    currentObjectPosition = new THREE.Vector2();

    //////Controls//////
    upArrowDown = false;
    downArrowDown = false;
    rightArrowDown = false;
    leftArrowDown = false;

    ///////Grid///////
    dragCountX = 0;
    dragCountZ = 0;

    ////////First person////////
    prevTime = performance.now();       //Used for movement
    fpRaycaster = new THREE.Raycaster( new THREE.Vector3(), new THREE.Vector3(0,-1,0), 0,0.1);  //Groundcheck
    velocity = new THREE.Vector3(0,0,0);
    direction = new THREE.Vector3(0,0,0);
    isFirstPerson = false;
    moveForward = false;    //All have to be given a value or we get NaN errors
    moveBackward = false;
    moveLeft = false;
    moveRight = false;

    ///////Mouse drag///////
    dragFlag = false;
    currentDragX = false;
    mouseDeltaX = 0;
    mouseDeltaY = 0;
    lastMouseX = 0;
    lastMouseY = 0;
    maxPlaneScale = 2.5;
    minPlaneScale = 0.3;
    planeScale = new THREE.Vector3(1,1,1);

    ///////Exporter///////
    exporter = new GLTFExporter();
    exportSuccess = false;  //Flag for confim animation

    /////////Time/////////
    clock = new THREE.Clock(true);  //Clock for animation
    skyColour = new THREE.Color(0.980, 0.929, 0.792);   //Default sky colour, light yellow
    dayFlag = false;
    sunStartPos = new THREE.Vector3();
    days = 0;
    
    changeCamera(isFirstPerson);
    loadAudio();
    loadFlagRollover();
    
    currentObject = placableObjects.trees.tree1;    //Default object selected
    updateCurrentObjectPath();                      //Update object filepath
    changeMouseMode(mouseMode.none);                //Set mouse mode to none
    currentObjectScale = 10;            //Defult scale and rotation
    currentObjectRotation = 0;

    document.getElementById("current-scale").innerHTML = " = "+currentObjectScale;
    document.getElementById("current-rotation").innerHTML = " = "+currentObjectRotation+"°";
    
    loadObjectRollover();

    //#endregion assignments and loaders

    //#region HTML

    link = document.createElement('a'); //Code for gltf exporter
    link.style.display = "none";
    document.body.appendChild(link);
    
    //////Export scene//////
    document.getElementById('export-scene').addEventListener('click', function(){exportScene();})
    confirmExport = document.getElementById("export-confirm");
    confirmExport.style.visibility = "hidden";
    filenameInput = document.getElementById('filename');
    
    /////help/////
    helpButton = document.getElementById("help-button").addEventListener('click', function(){toggleHelp();});
    helpBox = document.getElementById("help");
    helpBack = document.getElementById("help-back").addEventListener('click', function(){
        helpPage--;
        updateHelp();
    });
    helpForward = document.getElementById("help-forward").addEventListener('click', function(){
        helpPage++;
        updateHelp();
    });
    helpH2 = document.getElementById("help-h2");
    helpP = document.getElementById("help-p");
    helpPage = 0;
    updateHelp();
    toggleHelp();

    //////Controls boxes/////
    controlsBox1 = document.getElementById("controls-box");
    controlsBox2 = document.getElementById("controls-box-2");

    //////Toggle cam button////
    toggleCamButton = document.getElementById("toggle-cam");
    toggleCamButton.addEventListener('click', function(){
        isFirstPerson = !isFirstPerson;
        changeCamera(isFirstPerson);
    });

    fpControls = document.getElementById("controls-fp");
    
    //////Crosshair//////
    crosshair = document.getElementById("crosshair");

    /////Pos popup//////
    posPopup = document.getElementById("pos-popup");
    posPopup.style.visibility = "hidden";

    /////disabling interaction when hovering on UI elements
    infoBox = document.getElementById("info-box");
    infoBox.addEventListener('mouseenter', function(){ canInteract = false; })  //Top left info box
    infoBox.addEventListener('mouseleave', function(){ canInteract = true; })

    helpBox.addEventListener('mouseenter', function(){ canInteract = false; })    //Help box
    helpBox.addEventListener('mouseleave', function(){canInteract = true;})

    controlsBox1.addEventListener('mouseenter', function(){ canInteract = false; })    //Controls box 1
    controlsBox1.addEventListener('mouseleave', function(){canInteract = true;})

    controlsBox2.addEventListener('mouseenter', function(){ canInteract = false; })    //Controls box 2
    controlsBox2.addEventListener('mouseleave', function(){canInteract = true;})

    toggleCamButton.addEventListener('mouseenter', function(){ canInteract = false; })    //Cam toggle button
    toggleCamButton.addEventListener('mouseleave', function(){canInteract = true;})

    fpControls.addEventListener('mouseenter', function(){ canInteract = false; })    //First person controls
    fpControls.addEventListener('mouseleave', function(){canInteract = true;})

    gui.domElement.addEventListener('mouseenter', function(){ canInteract = false; })   //Dat gui
    gui.domElement.addEventListener('mouseleave', function(){ canInteract = true; })


    //#endregion HTML

}

function createPlane(pos){

    console.log("New plane at x:"+pos.x+"  z:"+pos.z);
    planeMesh = new THREE.Mesh(planeGeo, currentPlaneMat);
    planeMesh.castShadow = false;
    planeMesh.receiveShadow = true;
    planeMesh.name = "plane " + planeID;
    planeMesh.position.x = pos.x;
    planeMesh.position.z = pos.z;
    planeMesh.scale.set(planeScale.x,planeScale.y,planeScale.z);
    console.log(planeScale);
    scene.add(planeMesh);
    collisionObjects.push(planeMesh);

    updateGrid(false);
    
    dragMeshX = new THREE.Mesh(dragGeo, flagRollOverMaterial);
    dragMeshX.position.x = world.plane.width /2 + 5;
    dragMeshX.name = "dragMeshX";
    scene.add(dragMeshX);
    planeMesh.add(dragMeshX);
    dragables.push(dragMeshX);

    dragMeshZ = new THREE.Mesh(dragGeo, flagRollOverMaterial);
    dragMeshZ.position.z = world.plane.width /2 + 5;
    dragMeshZ.name = "dragMeshZ";
    scene.add(dragMeshZ);
    planeMesh.add(dragMeshZ);
    dragables.push(dragMeshZ);
    
    planeID++;
}

function updateGrid(clearCurrent){

    if(clearCurrent){   //Used when you need to clear the current mesh and create a new one
        gridSections.forEach(element => {
            scene.remove(element)
        });
        gridSections.length = 0;
    }

    const planeWidth = planeMesh.scale.x.toFixed(1) * 100;  //Get width and height of plane in cm
    const planeHeight = planeMesh.scale.z.toFixed(1) * 100;

    const startX = -planeWidth / 2 + gridSquareNum / 4;     //Get the start of the for loops
    const startZ = -planeHeight / 2 + gridSquareNum / 4;

    var i,j;
    var count = 0;
    for(i = startX ; i < planeWidth/2 ; i += gridSquareNum / 2)
    {
        for(j = startZ ; j < planeHeight/2 ; j += gridSquareNum / 2)
        {
            //console.log("pos x:"+i+"  z:"+j);
            const gridSquareMesh = new THREE.Mesh(gridSquareGeo, gridSquareMat);
            gridSquareMesh.position.x = i;
            gridSquareMesh.position.z = j;
            gridSquareMesh.position.y = 0.555;
            gridSquareMesh.name = "GridSection" + count;
            gridSections.push(gridSquareMesh);
            scene.add(gridSquareMesh);
            count++;
            //console.log(gridSquareMesh.name + "spawned at x:"+gridSquareMesh.position.x+"  y:"+gridSquareMesh.position.y+"  z:"+gridSquareMesh.position.z);
        }
    }



    console.log("grid complete with "+count+" sections")

}

function changeCamera(fp){
    document.exitPointerLock();

    var i,j;
    var count =0;
    for(i = 0;i<10;i++){
        for(j = 0;j<10;j++){
            //console.log("i:"+i+"  j:"+j);
            count ++;
        }
    }
    //console.log("count:"+count);


    if(!fp) //Orbit controls
    {
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
        controls.maxPolarAngle = Math.PI / 2.3;     //Restricts the cameras vertical rotation so you cant see under the plane
    
        controls.mouseButtons = {
            MIDDLE: THREE.MOUSE.PAN,  //Changed controls because left mouse is used for manipulating objects
            RIGHT: THREE.MOUSE.ROTATE
        }

        document.getElementById("crosshair").style.visibility = "hidden";
        document.getElementById("controls-fp").style.visibility = "hidden";
    }
    else{   //FP controls
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight,1,1000);
        camera.position.y = 10;

        controls = new PointerLockControls(camera, document.body);
        scene.add(controls.getObject());
        document.getElementById("crosshair").style.visibility = "visible";
        document.getElementById("controls-fp").style.visibility = "visible";
    }

    document.activeElement.blur();  //Disables the button as active element to avoid toggleing cam when pressing space
}

function addRestOfGUI(){
    const lightFolder = gui.addFolder("Lighting");
    lightFolder.add(world.lights, "timeScale", 1,10, 1).name("Orbit speed");
    lightFolder.add(world.lights, "sunCycleActive").name("Sun cycle").onChange(()=>{
        notifFlag = true;
        if(world.lights.sunCycleActive) notif.innerHTML = "Sun cycle enabled";
        else notif.innerHTML = "Sun cycle disabled";
    });
    lightFolder.add(world.lights, "flatLighting").name("Flat lighting").onChange(()=>{
        sunLight.visible = !world.lights.flatLighting;
        moonLight.visible = !world.lights.flatLighting;
        sunSphere.visible = !world.lights.flatLighting;
        moonSphere.visible = !world.lights.flatLighting;

        if(world.lights.flatLighting){
            hemiLight.intensity = 0.8;
            scene.background = skyColour;
        }
        else hemiLight.intensity = 0.3;

        notifFlag = true;
        if(world.lights.flatLighting) notif.innerHTML = "Flat lighting enabled";
        else notif.innerHTML = "Flat lighting disabled";
    } );

    const areaFolder = gui.addFolder("Area");       //Area folder added
    areaFolder.add(world.area, "type").options(areaTypes).name("Terrain type");  //Add area type dropdown selector
    areaFolder.add(world.area, "createNew").name("New area (Y)");       //Add new area button
    areaFolder.add(world.area,"finishArea").name("Finish area (U)");    //add finish area button
    areaFolder.add(world.area, "clearAreas").name("Clear areas (I)");

    const objectFolder = gui.addFolder("Objects");              //Add the objects folder
    objectFolder.add(world.objects, "place").name("Place (J)");     //Add place, remove, move buttons
    objectFolder.add(world.objects, "remove").name("Remove (K)");
    objectFolder.add(world.objects, "move").name("Move (L)");

    const treeFolder = objectFolder.addFolder("Trees");         //Add tree folder to the objects folder
    treeFolder.add(world.objects.trees, "tree1").name("Tree 1");
    treeFolder.add(world.objects.trees, "tree2").name("Tree 2");

    const plantFolder = objectFolder.addFolder("Plants");
    plantFolder.add(world.objects.plants, "tomato").name("Tomato");
    plantFolder.add(world.objects.plants, "strawberry").name("Strawberry");
    plantFolder.add(world.objects.plants, "cucumber").name("Cucumber");
    plantFolder.add(world.objects.plants, "lettuce").name("Lettuce");
    plantFolder.add(world.objects.plants, "carrot").name("Carrot");

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

    const bedsFolder = objectFolder.addFolder("Beds");
    bedsFolder.add(world.objects.beds, "squareRaised").name("Square raised");
    bedsFolder.add(world.objects.beds, "rectRaised").name("Rectangle raised");
    bedsFolder.add(world.objects.beds, "triangleRaised").name("Triangle raised");

    const wallFolder = objectFolder.addFolder("Walls");
    wallFolder.add(world.objects.walls, "fenceLow").name("Low fence");
    wallFolder.add(world.objects.walls, "fenceHigh").name("High fence");
    wallFolder.add(world.objects.walls, "brickLow").name("Low brick");
    wallFolder.add(world.objects.walls, "brickHigh").name("High brick");
    wallFolder.add(world.objects.walls, "stoneLow").name("Low stone");
    wallFolder.add(world.objects.walls, "stoneHigh").name("High stone");

    const leisureFolder = objectFolder.addFolder("Leisure");
    leisureFolder.add(world.objects.leisure, "bbq").name("BBQ");
    leisureFolder.add(world.objects.leisure, "firepit").name("Firepit");
    leisureFolder.add(world.objects.leisure, "swing").name("Swing");
    leisureFolder.add(world.objects.leisure, "goal").name("Goal");
    leisureFolder.add(world.objects.leisure, "sandbox").name("Sandbox");
}

function updateHelp(){
    if(helpPage <0) helpPage = 5;
    if(helpPage >5) helpPage = 0;
    console.log("Changing to help page: "+helpPage);

    switch(helpPage)
    {
        case 0:
            helpH2.innerHTML = "1: Plane";
            helpP.innerHTML = "Welcome to garden planner! Use this tool to plan your dream garden!  <br> Use the menu on the top right of the screen to make changes. <br> Start by altering the plane by changing the terrain type and grid snapping. Click the 'New plane' button or press the Y key to select the new plane tool. Click on the white spaces to create new planes.  <br> Press the help button to close this menu. <br><br>";
            break;
        case 1:
            helpH2.innerHTML = "2: Lighting";
            helpP.innerHTML = "Use the lighting panel to adjust the sun/moon orbit speed or disable it. <br> You can also enable flat lighting for constant lighting with no shadows. <br> <br> <br>";
            break;
        case 2:
            helpH2.innerHTML = "3: Area";
            helpP.innerHTML = "This panel is used to create areas of different types on top of the main plane. <br> You can choose the type of area you want to create, then enter area creation mode by clicking the button or pressing the Q key. <br> Click on the plane to create the outer points and the area will be created on the forth point. You can also create the area with less points using the E key. <br> <br> <br>";
            break;
        case 3:
            helpH2.innerHTML = "4: Objects";
            helpP.innerHTML = "The objects panel holds all the placable props in folders, such as trees, plants, and furniture.<br> There are also tools to be selected for placing objects (A key), removing objects (S key), and moving objects (D key). <br> <br> <br>";
            break;
        case 4:
            helpH2.innerHTML = "5: Camera";
            helpP.innerHTML = "There are two camera types available, orbit and first person. Click the camera button in the top left to toggle between them. <br>  "
            break;
        case 5:
            helpH2.innerHTML = "6: Exporting";
            helpP.innerHTML = "The 'export scene' button in the top-left allows you to export the scene as a .glTF model. This includes the plane and all the objects you placed on it. <br> You can enter a file name in the field below to rename the file. <br> <br>";
            break;
    }
}

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
        /////Plants//////
        case placableObjects.plants.tomato:
            currentObjectPath = 'models/plants/tomato.gltf';
            break;
        case placableObjects.plants.strawberry:
            currentObjectPath = 'models/plants/strawberry.gltf';
            break;
        case placableObjects.plants.cucumber:
            currentObjectPath = 'models/plants/cucumber.gltf';
            break;
        case placableObjects.plants.lettuce:
            currentObjectPath = 'models/plants/lettuce.gltf';
            break;
        case placableObjects.plants.carrot:
            currentObjectPath = 'models/plants/carrot.gltf';
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
        /////Beds////////
        case placableObjects.beds.squareRaised:
            currentObjectPath = 'models/beds/squareRaised.gltf';
            break;
        case placableObjects.beds.rectRaised:
            currentObjectPath = 'models/beds/rectRaised.gltf';
            break;
        case placableObjects.beds.triangleRaised:
            currentObjectPath = 'models/beds/triangleRaised.gltf';
            break;
        /////Walls//////
        case placableObjects.walls.fenceLow:
            currentObjectPath = 'models/walls/fenceLow.gltf';
            break;
        case placableObjects.walls.fenceHigh:
            currentObjectPath = 'models/walls/fenceHigh.gltf';
            break;
        case placableObjects.walls.brickLow:
            currentObjectPath = 'models/walls/brickLow.gltf';
            break;
        case placableObjects.walls.brickHigh:
            currentObjectPath = 'models/walls/brickHigh.gltf';
            break;
        case placableObjects.walls.stoneLow:
            currentObjectPath = 'models/walls/stoneLow.gltf';
            break;
        case placableObjects.walls.stoneHigh:
            currentObjectPath = 'models/walls/stoneHigh.gltf';
            break;
        /////Leisure/////
        case placableObjects.leisure.bbq:
            currentObjectPath = 'models/leisure/bbq.gltf';
            break;
    }

    document.getElementById("current-object").innerHTML = " = "+currentObject;
    changeMouseMode(mouseMode.objectPlace);
    console.log("Current object updated to: " + currentObject);
    loadObjectRollover();

    currentObjectScale = 10;
    currentObjectRotation = 0;
}

function loadAudio(){
    listener = new THREE.AudioListener();
    //camera.add(listener);

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

    grassMaterial = new THREE.MeshStandardMaterial({
        color: 0xdddddd,
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

    soilMaterial = new THREE.MeshStandardMaterial({
        color: 0xdddddd,
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

    gravelMaterial = new THREE.MeshStandardMaterial({
        color: 0xdddddd,
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

    stoneMaterial = new THREE.MeshStandardMaterial({
        color: 0xdddddd,
        map: stoneTexture,
        normalMap: stoneNormal,
        side: THREE.DoubleSide
    })

    gridTexture = new THREE.TextureLoader().load("textures/grid.png");

    gridSquareMat = new THREE.MeshBasicMaterial({
        color: 0xdddddd,
        map: gridTexture,
        transparent: true
    })

    gridTexture.wrapS = THREE.RepeatWrapping;
    gridTexture.wrapT = THREE.RepeatWrapping;
    //gridTexture.repeat.set(20, 20);

    gridMaterial = new THREE.MeshStandardMaterial({
        color: 0xdddddd,
        map: gridTexture,
        transparent: true
    })

    
    /////Other mats/////
    
    sunTexture = new THREE.TextureLoader().load("textures/sun.png");

    sunMaterial = new THREE.MeshStandardMaterial( { 
        color: 0xffbb00,
        map: sunTexture,
        emissive: 0xffbb00,
        emissiveIntensity: 5
    } );
    
    moonTexture = new THREE.TextureLoader().load("textures/moon.png");

    moonMaterial =  new THREE.MeshStandardMaterial( { 
        color: 0xffffff, 
        map: moonTexture,
        emissive: 0xffffff, 
        emissiveIntensity: 0.5 
    } );

    outlineMaterial = new THREE.LineBasicMaterial({ color: 0xfffffff });    //White, used for lines between area points

    starTexture = new THREE.TextureLoader().load("textures/stars.png");

    objectRolloverMaterial = new THREE.MeshBasicMaterial({ opacity: 0.5, transparent: true});
    flagRollOverMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, opacity: 0.5, transparent: true });
}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onPointerMove(event) {

    if(canInteract){

        ///////Rollovers///////
        pointer.set((event.clientX / window.innerWidth) * 2 - 1, - (event.clientY / window.innerHeight) * 2 + 1);

        if(isFirstPerson) raycaster.setFromCamera(new THREE.Vector2(), camera);
        else raycaster.setFromCamera(pointer, camera);

        //////Intersection for grid///////
        if(world.plane.grid){
            const gridIntersects = raycaster.intersectObjects(gridSections);

            if(gridIntersects.length > 0)
            {
                const intersect = gridIntersects[0];
                currentGridpos = new THREE.Vector3(intersect.object.position.x, intersect.object.position.y, intersect.object.position.z);
    
                intersect.object.material = flagRollOverMaterial;
                console.log("sel:"+selectedSection.name+"    int:"+intersect.object.name)
                if(intersect.object.name != selectedSection.name){
                    selectedSection.material = gridSquareMat;
                    console.log("match");
                }
                    
                selectedSection = intersect.object;
            }
        }


        /////Intersection for mouse modes//////
        const intersects = raycaster.intersectObjects(collisionObjects); //objects[] contains the plane
    
        if (intersects.length > 0) {
    
            const intersect = intersects[0];    //intersects[] contains the intersection data
            switch(currentMouseMode)    //Switch for mouse modes
            {
                case mouseMode.areaDef:
                    flagRollOverMesh.visible = true;
                    flagRollOverMesh.position.copy(intersect.point).add(intersect.face.normal);
                    if(world.plane.snapToGrid){
                        flagRollOverMesh.position.x = currentGridpos.x;
                        flagRollOverMesh.position.z = currentGridpos.z;
                    } 

                    posPopup.style.visibility = "visible";
                    posPopup.innerHTML = "x:"+(flagRollOverMesh.position.x).toFixed(1)+"cm  y:"+(flagRollOverMesh.position.z).toFixed(1)+"cm";

                    break;
                case mouseMode.objectPlace:
                    flagRollOverMesh.visible = false;
                    objectRolloverMesh.visible = true;
                    objectRolloverActive = true;
    
                    objectRolloverMesh.position.copy(intersect.point).add(intersect.face.normal);
                    if(world.plane.snapToGrid){
                    objectRolloverMesh.position.x = currentGridpos.x;
                    objectRolloverMesh.position.z = currentGridpos.z;
                    }       

                    posPopup.style.visibility = "visible";
                    posPopup.innerHTML = "x:"+objectRolloverMesh.position.x+"cm  y:"+objectRolloverMesh.position.z+"cm";

                    objectRolloverMesh.scale.set(currentObjectScale,currentObjectScale,currentObjectScale);  //Set scale
                    objectRolloverMesh.rotation.y = THREE.Math.degToRad(currentObjectRotation);  //Set rotation
                    objectRolloverMesh.position.y -= 1; 

                    currentObjectPosition.x = objectRolloverMesh.position.x;
                    currentObjectPosition.y = objectRolloverMesh.position.z;
                    
                    break;
                case mouseMode.objectRemove:
                    objectRolloverMesh.visible = false;
                    objectRolloverActive = false;
                    break;
                case mouseMode.objectMove:
                    objectRolloverMesh.visible = false;
                    objectRolloverActive = false;
                    break;
                case mouseMode.newPlane:
                    break;
            }
        }
        else{
            if(flagRollOverMesh != null) flagRollOverMesh.visible = false;      //Removes the rollover mesh when the pointer isnt in a valid position
            if(objectRolloverMesh != null) objectRolloverMesh.visible = false;
            posPopup.style.visibility = "hidden";
        }

        ///////Plane drag///////
        
        if(dragFlag){
            var mouseX = event.clientX;
            var mouseY = event.clientY;
        
            mouseDeltaX = mouseX - lastMouseX;
            mouseDeltaY = mouseY - lastMouseY;
    
            var xFactor = Math.sign(mouseDeltaX);
            var zFactor = Math.sign(mouseDeltaY);
            
            if(currentDragX) {
                if(xFactor > 0) {
                    dragCountX++;
                    if(dragCountX % 5 == 0) planeScale.x += 0.1;
                }
                if(xFactor < 0){
                    dragCountX--;
                    if(dragCountX % 5 ==0) planeScale.x -= 0.1;
                }                
                notification("Garden width: "+(planeMesh.scale.x.toFixed(1) * 100).toFixed(1)+"cm");
            }
            else{
                if(zFactor > 0){
                    dragCountZ++;
                    if(dragCountZ % 5 == 0) planeScale.z += 0.1;
                }
                if(zFactor < 0){
                    dragCountZ--;
                    if(dragCountZ % 5 == 0) planeScale.z -= 0.1;
                }                
                notification("Garden height: "+(planeMesh.scale.z.toFixed(1) * 100).toFixed(1)+"cm");
            }
            
            var childScale = new THREE.Vector3(1 / planeMesh.scale.x, 1 / planeMesh.scale.y, 1 / planeMesh.scale.z);
            dragMeshX.scale.set(childScale.x, childScale.y, childScale.z);      //Prevents gizmo from scaling with the plane
            dragMeshZ.scale.set(childScale.x, childScale.y, childScale.z);

            lastMouseX = mouseX;
            lastMouseY = mouseY;

            planeMesh.scale.set(planeScale.x,planeScale.y,planeScale.z);

            //Restrict min and max scale
            if(planeMesh.scale.x > maxPlaneScale) planeMesh.scale.set(maxPlaneScale, planeMesh.scale.y, planeMesh.scale.z);
            if(planeMesh.scale.x < minPlaneScale) planeMesh.scale.set(minPlaneScale, planeMesh.scale.y, planeMesh.scale.z);
            
            if(planeMesh.scale.z > maxPlaneScale) planeMesh.scale.set(planeMesh.scale.x, planeMesh.scale.y, maxPlaneScale);
            if(planeMesh.scale.z < minPlaneScale) planeMesh.scale.set(planeMesh.scale.x, planeMesh.scale.y, minPlaneScale);

            updateGrid(true);

            objectGroundCheck();
        }
    }
}

function objectGroundCheck(){
    placedObjects.forEach(element => {
        const raycaster = new THREE.Raycaster(new THREE.Vector3(element.position.x, element.position.y+1, element.position.z), new THREE.Vector3(0,-1,0));
        const intersects = raycaster.intersectObjects(gridSections);
        console.log(intersects);
        if(intersects.length == 0){
            console.log("intersect obj:"+element.name);
            scene.remove(element);
        }
    });
}

function onPointerDown(event) {

    if(canInteract){

        pointer.set((event.clientX / window.innerWidth) * 2 - 1, - (event.clientY / window.innerHeight) * 2 + 1);   //Pointer is the mouse position on the screen as a vec2
                        
        if(isFirstPerson && controls.isLocked) raycaster.setFromCamera(new THREE.Vector2(), camera);     //When in first person, cast ray from center of screen (crosshair)
        else raycaster.setFromCamera(pointer, camera);

        let intersects;     //Intersects array

        intersects = raycaster.intersectObjects(dragables); //Check for intersect with dragables first
        if(intersects.length > 0){
            const intersect = intersects[0];

            if(intersect.object.name == "dragMeshX") currentDragX = true;
            else if(intersect.object.name == "dragMeshZ") currentDragX = false;

            dragFlag = true;
        }
        
        switch (currentMouseMode){

            case mouseMode.none:

                switch(event.which){
                    case 1: //Left click
                        break;
                    case 2: //Middle click
                        break;
                    case 3: //Right click
                        break;
                }
    
                break;
            case mouseMode.areaDef:

                intersects = raycaster.intersectObjects(collisionObjects); //intersect[] contains the plane and all stackable objects

                if(intersects.length > 0){

                    const intersect = intersects[0];

                    switch(event.which){
                        case 1: //Left click
    
                            if(!outlineFinished)
                            {
                                if (collisionObjects.includes(intersect.object)){ spawnNode(intersect); }  //if intersect is included in the objects array
                            }
    
                            break;
                        case 2: //Middle click
                            break;
                        case 3: //Right click
                            break;
                    }
                }

                break;
            case mouseMode.objectPlace:

                intersects = raycaster.intersectObjects(collisionObjects); //intersect[] contains the plane and all stackable objects
                if(intersects.length > 0)
                {
                    const intersect = intersects[0];

                    switch(event.which){
                        case 1: //Left click
                            if (collisionObjects.includes(intersect.object)){    //if intersect is included in the objects array
                            spawnObject(intersect);
                        }
    
                        if(isMoving) {
                            changeMouseMode(mouseMode.objectMove); 
                            isMoving = false;
                            objectRolloverMesh.visible = false;
                            objectRolloverActive = false;
                        }
    
                            break;
                        case 2: //Middle click
                            break;
                        case 3: //Right click
                            break;
                    }
                }

                break;
            case mouseMode.objectRemove:

                intersects = raycaster.intersectObjects(placedObjects, true); //intersect[] contains the plane and all stackable objects

                if(intersects.length > 0)
                {
                    const intersect = intersects[0];

                    switch(event.which){
                        case 1: //Left click
    
                            const parentId = intersect.object.parent.parent.id;
            
                            intersect.object.parent.traverse(n =>{
                                scene.remove(n);
                            })
        
                            scene.remove(scene.getObjectById(parentId));  //Removes the parent of the object 
                            console.log("Removed object: "+parentId);
        
                            const index = placedObjects.indexOf(intersect.object.parent);   //Removes the object from the array
                            if(index > -1) placedObjects.splice(index,1);
                            deleteSound.play();
    
                            break;
                        case 2: //Middle click
                            break;
                        case 3: //Right click
                            break;
                    }
                }

                

                break;
            case mouseMode.objectMove:

                switch(event.which){
                    case 1: //Left click

                        intersects = raycaster.intersectObjects(placedObjects, true); //intersect[] contains the plane and all stackable objects

                        if(intersects.length > 0)
                        {
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
                    case 3: //Right click
                        break;
                }

                break;
        }
    }
    
    if(isFirstPerson && canInteract) controls.lock();
}

function onPointerUp(event){
    if(canInteract){
        dragFlag = false;
        dragCountX = 0;
        dragCountZ = 0;
    }
}

function spawnNode(intersect){

    let node;   //temp variable to store the gltf.scene object
    new GLTFLoader().load('models/markerpost.gltf', function(gltf){ //gltf loader loads marker post model
        node = gltf.scene;      //gltf model assigned to node object
        node.traverse(n =>{       //Sets all the meshes in the object to cast and recieve shadows
            if(n.isMesh){
                n.castShadow = true;
                n.receiveShadow = true;
            }
        })

        node.scale.set(13,13,13);       //Increase scale
        node.position.copy(intersect.point).add(intersect.face.normal); //Set position to the intersect
        if(world.plane.snapToGrid) node.position.x = currentGridpos.x; node.position.z = currentGridpos.z;   //Adds grid snapping if checked
        scene.add(node);        //Add the node to the scene

        node.name = "node " + nodeID;   //Give the node a name with the id
        nodeID++;       //increment id 
        nodes.push(node);               //Push node to the array of nodes
        console.log("Pushed outline node:" + node.name);

        const pos = node.position;     //temp variable to store the point
        outlinePoints.push(new THREE.Vector3(pos.x, pos.y, pos.z)); //Push a new point to the outline points array
        console.log("Added outlinePoint at x:" + pos.x.toFixed(2) + "  y:" + pos.y.toFixed(2) + "  z:" + pos.x.toFixed(2));

        notifFlag = true;
        notif.innerHTML = "Flag placed at x:"+node.position.x+"cm  y:"+node.position.z+"cm";

        if (outlinePoints.length > 1) { drawLine(); }         //if there is more than one point, draw a line between them

        if (outlinePoints.length == 4) { finalOutline(); }    //Finishes the outline on four points

    });
}

function spawnObject(intersect){

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
        placableObject.position.set(objectRolloverMesh.position.x, objectRolloverMesh.position.y, objectRolloverMesh.position.z);    //Offset so objects aren't floating
    
        //if(world.plane.snapToGrid) placableObject.position.divideScalar( gridSnapFactor/4 ).floor().multiplyScalar( gridSnapFactor/4 ).addScalar( gridSnapFactor/8 );   //Adds grid snapping if checked
        if(world.plane.snapToGrid){
            placableObject.position.x = currentGridpos.x;   //Adds grid snapping if checked
            placableObject.position.z = currentGridpos.z;   //Adds grid snapping if checked

        }
        placableObject.scale.set(currentObjectScale,currentObjectScale,currentObjectScale);  //Set scale
        placableObject.rotation.y = THREE.Math.degToRad(currentObjectRotation);  //Set rotation
        scene.add(placableObject);        //Add the object to the scene
    
        placableObject.name = currentObject;
    
        if(placableObject.name == "Pot" || placableObject.name == "Square raised"){                                    
            placableObject.traverse(n=>{
                if(n.isMesh){ 
                    collisionObjects.push(n);
                    n.name = currentObject;
                }
            })
            console.log("Pushed object:" + placableObject.name + " to collisionObjects");
        } 
        else {
            placedObjects.push(placableObject);               //if obj is not to be collided with, add to array of objs
            console.log("Pushed object:" + placableObject.name + " to placedObjects");
        }
        spawnSound.play();

    });


}

function onDocumentKeyDown(event) {

    //////Scale and rotation//////
    switch (event.keyCode) {
        /////Arrow keys//////
        case 38:    //Arrow up - scale up
            upArrowDown = true;
            break; 
        case 40:    //Arrow down - scale down
            downArrowDown = true;
            break; 
        case 37:  //Arrow left - -rotation
            leftArrowDown = true;
            break; 
        case 39:  //Arrow right - +rotation
            rightArrowDown = true;  
            break; 
    }

    //////Macros///////
    if(filenameInput != document.activeElement)
    {
        switch(event.keyCode)
        {
            case 89: //y - new area
                changeMouseMode(mouseMode.areaDef);
                break;
            case 85: //u - finish area
                finalOutline();
                break;
            case 73: //i - clear areas
                clearAreas();
                break;
            case 74: //j - place obj
                changeMouseMode(mouseMode.objectPlace);
                break;
            case 75: //k - remove obj 
                changeMouseMode(mouseMode.objectRemove);
                break;
            case 76: //l - move obj
                changeMouseMode(mouseMode.objectMove);
                break;
            case 67: //c - toggle cam
                isFirstPerson = !isFirstPerson;
                changeCamera(isFirstPerson);
                break;
        }
    }

    //////First person controls/////
    if(isFirstPerson){
        switch(event.code){
            case 'KeyW':
                moveForward = true;
                break;
            case 'KeyA':
                moveLeft = true;
                break;
            case 'KeyS':
                moveBackward = true;
                break;
            case 'KeyD':
                moveRight = true;
                break;
            case 'Space':
                if (canJump) velocity.y += 170;
                canJump = false;
                break;
        }
    }

    objectRolloverMesh.scale.set(currentObjectScale,currentObjectScale,currentObjectScale);  //Set scale
    objectRolloverMesh.rotation.y = THREE.Math.degToRad(currentObjectRotation);  //Set rotation
}

function onDocumentKeyUp(event) {

    if(isFirstPerson){
        switch(event.code){
            case 'KeyW':
                moveForward = false;
                break;
            case 'KeyA':
                moveLeft = false;
                break;
            case 'KeyS':
                moveBackward = false;
                break;
            case 'KeyD':
                moveRight = false;
                break;
        }
    }

    switch (event.keyCode) {
        /////Arrow keys//////
        case 38:    //Arrow up - scale up
            upArrowDown = false;
            break; 
        case 40:    //Arrow down - scale down
            downArrowDown = false;
            break; 
        case 37:  //Arrow left - -rotation
            leftArrowDown = false;
            break; 
        case 39:  //Arrow right - +rotation
            rightArrowDown = false;
            break; 
    }
}

function updateScaleAndRotation(){
    if(upArrowDown) currentObjectScale += 0.1;
    if(downArrowDown) currentObjectScale -= 0.1;
    if(rightArrowDown) currentObjectRotation += 0.5;
    if(leftArrowDown) currentObjectRotation -= 0.5;

    if(currentObjectRotation < 0 ) currentObjectRotation = 360;
    if(currentObjectRotation > 360) currentObjectRotation = 0;
    if(currentObjectScale < 0) currentObjectScale = 1;

    document.getElementById("current-scale").innerHTML = " = "+currentObjectScale.toFixed(0);
    document.getElementById("current-rotation").innerHTML = " = "+currentObjectRotation.toFixed(0)+"°";

}

function animate() {

    requestAnimationFrame(animate);
    ///////Camera////////////
    if(!isFirstPerson) controls.update();   //Controls.update() is only for orbit controls
    else{       //First person code
        const time = performance.now();
        
        if(controls.isLocked)
        {
            fpRaycaster.ray.origin.copy(controls.getObject().position);
            fpRaycaster.ray.origin.y -= 10;

            const intersections = fpRaycaster.intersectObjects(collisionObjects);
            const onObject = intersections.length > 0;

            const delta = (time - prevTime)/1000;

            velocity.x -= velocity.x * 15 * delta;
            velocity.z -= velocity.z * 15 * delta;
            velocity.y -= 9.8 * 70 * delta;    //100 = mass
    
            direction.z = Number(moveForward) - Number(moveBackward);
            direction.x = Number(moveRight) - Number(moveLeft);
            direction.normalize();
    
            if(moveForward || moveBackward) velocity.z -= direction.z * 400.0 * delta;
            if(moveLeft || moveRight) velocity.x -= direction.x * 400.0 * delta;
    
            if(onObject){
                velocity.y = Math.max(0, velocity.y);
                canJump = true;
            }

            controls.moveRight(-velocity.x *delta);
            controls.moveForward(-velocity.z * delta);
            controls.getObject().position.y += (velocity.y * delta);

            if(controls.getObject().position.y < 10){
                velocity.y = 0;
                controls.getObject().position.y = 10;
                canJump = true;
            }

            if(controls.getObject().position.y < -100) controls.getObject().position = new THREE.Vector3(0,10,0);
        }

        prevTime = time;
    }

    ////////Sun cycle/////////////
    if(world.lights.sunCycleActive && !world.lights.flatLighting)     //If the sun cycle is active
    {
        
        if(!clock.running) clock.start();
        timestamp = clock.getElapsedTime() * world.lights.timeScale *0.1;
        //console.log("Time: "+timestamp);

        sunPosition.position.set(Math.cos(timestamp)*world.lights.orbitRadius,  //Set sunPos
         Math.sin(timestamp) * world.lights.orbitRadius *1.5,       //*1.5 offsets vertical orbit slightly, makes for a steeper orbit
         Math.sin(timestamp) * world.lights.orbitRadius);

        //console.log(sunPosition.position.y.toFixed(0));

        if(sunPosition.position.y.toFixed(0) == -225){
            incrementDays(clock.getElapsedTime());
        } 

        sunLight.position.set(sunPosition.position.x, sunPosition.position.y, sunPosition.position.z);  //Set light and sphere to sunPos
        sunSphere.position.set(sunPosition.position.x, sunPosition.position.y, sunPosition.position.z);

        
        moonLight.position.set(-sunPosition.position.x, -sunPosition.position.y, -sunPosition.position.z);  //Set moon light and sphere to -sunPos
        moonSphere.position.set(-sunPosition.position.x, -sunPosition.position.y, -sunPosition.position.z);

        hemiLight.intensity = Math.max(0.3, Math.sin(timestamp));   //Changes the intensity of the hemisphere light with the position of the sunlight to simulate reflected light and soften shadows

        let col;    //Temp variable for background colour
        let val = Math.trunc(Math.max(0,Math.sin(timestamp)) * 100);    //Get col value for changing background colour with time
        col = new THREE.Color("hsl(44, 83%, "+val+"%)")    //Set background colour
        
        if(val > 0){    //Change to sky colour
            col.r = Math.min(col.r, skyColour.r);
            col.g = Math.min(col.g, skyColour.g);
            col.b = Math.min(col.b, skyColour.b);

            col.r += 0.01;
            col.g += 0.01;
            col.b += 0.01;
        }

        if(val == 0) scene.background = starTexture;    //If night, set background tex to stars
        
        scene.background = col;

        if(sunSphere.position.y <= -15) sunSphere.visible = false;  //Hides the sun and moon when they go slightly below the plane
        else sunSphere.visible = true;
        if(moonSphere.position.y <= -15) moonSphere.visible = false;
        else moonSphere.visible = true;

        ambiLight.visible = false;
    }
    else {      //If sun cycle isnt running
        if(clock.running) clock.stop();
        hemiLight.intensity = 0.4; //If sun cycle isn't active, default to 0.4 intensity
        ambiLight.visible = true;
    }

    ////////Export timer/////////
    if(exportSuccess)   //Export confirm appears for a couple of seconds
    {
        confirmExport.style.visibility = "visible";
        confirmExportTimer += clock.getDelta();
        if(confirmExportTimer > 0.004)
        {
            confirmExport.style.visibility = "hidden";
            exportSuccess = false;
            confirmExportTimer = 0;
        }
    }

    ////////Plane change notif////
    if(notifFlag){
        notif.style.visibility = 'visible';
        planeChangeTimer += clock.getDelta();

        if(planeChangeTimer > 0.007){
            notif.style.visibility = 'hidden';
            notifFlag = false;
            planeChangeTimer = 0;
        }
    }

    updateScaleAndRotation();

    render();
}
animate();

function render(){
    renderer.render(scene, camera);
    //labelRenderer.render(scene,camera);
}

function incrementDays(timestamp){
    if(timestamp == clock.getElapsedTime()){
        //console.log(timestamp + "----"+clock.getElapsedTime());
        days++;
        //console.log("Day added: " + days)
    }

}

function drawLine() {
    scene.remove(scene.getObjectByName("outline")); //Deletes the old line object for efficiency

    outlineGeo = new THREE.BufferGeometry().setFromPoints(outlinePoints);
    const lineMesh = new THREE.Line(outlineGeo, outlineMaterial);
    lineMesh.name = "outline";
    scene.add(lineMesh);
}

function finalOutline() {
    if (outlinePoints.length > 2) { //If it is a triangle or more (>2 points)
        console.log("Area created");
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

        notifFlag = true;
        notif.innerHTML = "Area created";

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
        scene.remove(scene.getObjectByName("node "+i));
    }
    nodes.length = 0;
    outlinePoints.length = 0;
    nodeID = 0;

    outlineFinished = false;

    scene.remove(scene.getObjectByName("outline"));
}

function clearAreas(){
    for(let i in areas)
    {
        scene.remove(scene.getObjectByName("area "+i));
    }
    areas.length = 0;
    areaID = 0;
}

function loadObjectRollover()
{
    new GLTFLoader().load(currentObjectPath, function(gltf){
        objectRolloverMesh = gltf.scene;
        objectRolloverMesh.traverse(function(child){
            if(child instanceof THREE.Mesh) { child.material = objectRolloverMaterial; } //Makes the object transparent
        });
        scene.add(objectRolloverMesh);
        objectRolloverMesh.visible = false;
        objectRolloverActive = false;
    });
}

function loadFlagRollover(){

    const flagRolloverGeo = new THREE.SphereGeometry(1,32,16);

    flagRollOverMesh = new THREE.Mesh(flagRolloverGeo, flagRollOverMaterial);
    scene.add(flagRollOverMesh);
    flagRollOverMesh.name = "FlagRollover";
    flagRollOverMesh.visible = false;
}

function notification(string){
    notifFlag = true;
    notif.innerHTML = string;
}

function changeMouseMode(mode)
{
    const tool = document.getElementById("current-tool");
    switch(mode)
    {
        case mouseMode.none:
            currentMouseMode = mouseMode.none;
            flagRollOverMesh.visible = false;
            planeSelectors.forEach(item => item.visible = false);
            tool.innerHTML = " = none";

            notification("No tool selected");
            break;
        case mouseMode.areaDef:
            currentMouseMode = mouseMode.areaDef;
            resetOutline();
            flagRollOverMesh.visible = true;
            planeSelectors.forEach(item => item.visible = false);
            tool.innerHTML = " = create area";
            
            notification("Tool selected: Create area");
            break;
        case mouseMode.objectPlace:
            currentMouseMode = mouseMode.objectPlace;
            flagRollOverMesh.visible = false;
            planeSelectors.forEach(item => item.visible = false);
            tool.innerHTML = " = place object";

            notification("Tool selected: Place object");
            break;
        case mouseMode.objectRemove:
            currentMouseMode = mouseMode.objectRemove;
            flagRollOverMesh.visible = false;
            planeSelectors.forEach(item => item.visible = false);
            tool.innerHTML = " = remove object";

            notification("Tool selected: Remove object");
            break;
        case mouseMode.objectMove:
            currentMouseMode = mouseMode.objectMove;
            flagRollOverMesh.visible = false;
            planeSelectors.forEach(item => item.visible = false);
            tool.innerHTML = " = move object";

            notification("Tool selected: Move object");
            break;
    }

    if(mode != mouseMode.areaDef) if(outlinePoints.length >0) resetOutline();    //Auto resets area creation when switching to another tool
}

function exportScene()
{
    hemiLight.visible = false;
    flagRollOverMesh.visible = false;
    objectRolloverMesh.visible = false;
    objectRolloverActive = false;
    sunSphere.visible = false;
    moonSphere.visible = false;

    let filename = filenameInput.value;
    if(filename == "") filename = "Garden";
    filenameInput.value = "";

    exporter.parse( scene, function ( gltf ) {
        if(gltf instanceof ArrayBuffer){
            saveArrayBuffer(gltf, filename+'.glb');
        }else{
            const output = JSON.stringify( gltf, null, 2);
            saveString(output, filename+'.gltf');
        }
    } )

    exportSuccess = true;

    hemiLight.visible = true;
    sunSphere.visible = true;
    moonSphere.visible = true;
}

function save(blob, filename)
{
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

function saveString(text, filename)
{
    save(new Blob ( [text], { type: 'text/plain' } ), filename );
}

function saveArrayBuffer(buffer, filename)
{
    save( new Blob ( [ buffer ], { type: 'application/octet-stream' } ), filename );
}

function toggleHelp(){

    helpActive = !helpActive;

    if(helpActive){
        helpBox.style.visibility = "visible";
        gui.hide();
    }
    else {
        helpBox.style.visibility = "hidden";
        gui.show();
    }
}