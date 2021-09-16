import * as THREE from "https://unpkg.com/three@0.126.1/build/three.module.js";

import { OrbitControls } from "https://unpkg.com/three@0.126.1/examples/jsm/controls/OrbitControls.js";
import { ConvexGeometry } from "https://unpkg.com/three@0.126.1/examples/jsm/geometries/ConvexGeometry.js";
import { GUI } from "https://unpkg.com/three@0.126.1/examples/jsm/libs/dat.gui.module.js";
import { GLTFLoader } from "https://unpkg.com/three@0.126.1/examples/jsm/loaders/GLTFLoader.js";
import { GLTFExporter } from "https://unpkg.com/three@0.126.1/examples/jsm/exporters/GLTFExporter.js";

//#region declarations
let camera, listener, scene, renderer, controls, gui, world;
let hemiLight, sunLight, moonLight, pointLight;
let sunPosition,sunGeometry, sunTexture, sunMaterial, sunSphere, moonTexture, moonMaterial, moonSphere, timestamp, clock;
let planeMesh;
let pointer, raycaster;
let markerSound, spawnSound, deleteSound;

let grassTexture, grassNormal, soilTexture, soilNormal, gravelTexture, gravelNormal, stoneTexture, stoneNormal, gridTexture;
let grassMaterial, soilMaterial, gravelMaterial, stoneMaterial, gridMaterial;
let starTexture, skyColour;

let flagRollOverGeo, flagRollOverMesh, flagRollOverMaterial;
let objectRolloverMesh, objectRolloverMaterial;
let nodeID;
let outlineGeo, outlineMaterial;
let gridGeo, gridMesh, gridSnapFactor;
let areaGeo, areaID, areaHeightOffset, planeGeo;
let outlineFinished = new Boolean;
let exportSuccess = new Boolean;
let canInteract = new Boolean;

let exporter, link, confirmExport, confirmExportTimer, filenameInput, box, box2;

const collisionObjects = [];
const nodes = [];
const areas = [];
const outlinePoints = [];
const placedObjects = [];

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
    objectMove: "Object move"
}

let currentMouseMode = mouseMode.areaDef;

let currentObject, currentObjectPath, isMoving, currentObjectScale, currentObjectRotation;

//#endregion declarations

init();

function init() {

    //#region renderer and scene setup

    scene = new THREE.Scene();
    scene.background = skyColour;

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

    hemiLight = new THREE.HemisphereLight(0xfdfbd3 , 0x34ad61, 0.4);
    scene.add(hemiLight);

    pointLight = new THREE.PointLight(0xffa95c, 0.6); //Dir light for when flat lighting is checked

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
        collisionObjects.length = 0; //Clears the objects array

        scene.remove(planeMesh);    //deletes the old mesh

        //reset size sliders to 100

        switch(world.plane.type)    //generates a new mesh with the selected material
        {
            case areaTypes.grass:
                planeMesh = new THREE.Mesh(planeGeo, grassMaterial);
                planeMesh.recieveShadow = true;
                planeMesh.name = "plane";
                scene.add(planeMesh);
                collisionObjects.push(planeMesh);
                break;
            case areaTypes.soil:
                planeMesh = new THREE.Mesh(planeGeo, soilMaterial);
                planeMesh.recieveShadow = true;
                planeMesh.name = "plane";
                scene.add(planeMesh);
                collisionObjects.push(planeMesh);
                break;
            case areaTypes.gravel:
                planeMesh = new THREE.Mesh(planeGeo, gravelMaterial);
                planeMesh.recieveShadow = true;
                planeMesh.name = "plane";
                scene.add(planeMesh);
                collisionObjects.push(planeMesh);
                break;
            case areaTypes.stone:
                planeMesh = new THREE.Mesh(planeGeo, stoneMaterial);
                planeMesh.recieveShadow = true;
                planeMesh.name = "plane";
                scene.add(planeMesh);
                collisionObjects.push(planeMesh);
                break;
        }
    });
    planeFolder.add(world.plane, "grid").name("Enable grid").onChange(()=>{ gridMesh.visible = world.plane.grid; })
    planeFolder.add(world.plane, "snapToGrid").name("Snap to grid");
    planeFolder.add(world.plane, "finalPlane").name("Finalise plane");  //Button to finalise plane. Removes plane folder
    planeFolder.open();

    const lightFolder = gui.addFolder("Lighting");
    lightFolder.add(world.lights, "timeScale", 1,10, 1).name("Orbit speed");
    lightFolder.add(world.lights, "sunCycleActive").name("Sun cycle");
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
    } );

    const areaFolder = gui.addFolder("Area");       //Area folder added
    areaFolder.add(world.area, "type").options(areaTypes).name("Terrain type");  //Add area type dropdown selector
    areaFolder.add(world.area, "createNew").name("New area (Q)");       //Add new area button
    areaFolder.add(world.area, "continueArea").name("Continue Area (W)");
    areaFolder.add(world.area,"finishArea").name("Finish area (E)");    //add finish area button
    areaFolder.add(world.area, "clearAreas").name("Clear areas (R)");

    const objectFolder = gui.addFolder("Objects");              //Add the objects folder
    objectFolder.add(world.objects, "place").name("Place (A)");     //Add place, remove, move buttons
    objectFolder.add(world.objects, "remove").name("Remove (S)");
    objectFolder.add(world.objects, "move").name("Move (D)");

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

    
    new GLTFLoader().load('models/markerpost.gltf', function(gltf){ //gltf loader loads marker post model
        flagRollOverGeo = gltf.scene;      //gltf model assigned to node object
    })
    
    flagRollOverMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, opacity: 0.5, transparent: true });
    flagRollOverMesh = new THREE.Mesh(flagRollOverGeo, flagRollOverMaterial);
    flagRollOverMesh.name = "Flag rollover";
    scene.add(flagRollOverMesh);

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
    
    collisionObjects.push(planeMesh);

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
    areaHeightOffset = 0;
    isMoving = false;
    gridSnapFactor = 5;
    confirmExportTimer = 0;
    canInteract = true;

    clock = new THREE.Clock(true);  //Clock for animation
    skyColour = new THREE.Color(0.980, 0.929, 0.792);   //Default sky colour, light yellow

    currentObject = placableObjects.trees.tree1;    //Default object selected
    updateCurrentObjectPath();                      //Update object filepath
    changeMouseMode(mouseMode.none);                //Set mouse mode to none
    currentObjectScale = 10;            //Defult scale and rotation
    currentObjectRotation = 0;
    
    loadAudio();
    loadRollover();

    //#endregion assignments and loaders

    //#region HTML

    exporter = new GLTFExporter();      //Exporter for GLTF
    link = document.createElement('a'); //Code for gltf exporter
    link.style.display = "none";
    document.body.appendChild(link);
    exportSuccess = false;

    document.getElementById('export-scene').addEventListener('click', function(){exportScene();})
    confirmExport = document.getElementById("export-confirm");
    confirmExport.style.visibility = "hidden";
    
    filenameInput = document.getElementById('filename');

    box = document.getElementById("box");
    box2 = document.getElementById("box2");
    
    box.addEventListener('mouseenter', function(){
        canInteract = false;
        console.log(canInteract);
        objectRolloverMesh.visible = false;
    })
    box.addEventListener('mouseleave', function(){
        canInteract = true;
        console.log(canInteract);
    })

    gui.domElement.addEventListener('mouseenter', function(){
        console.log("Enter gui");
        canInteract = false;
    })
    gui.domElement.addEventListener('mouseleave', function(){
        console.log("Leave gui");
        canInteract = true;
    })

    //#endregion HTML

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
    loadRollover();

    currentObjectScale = 10;
    currentObjectRotation = 0;
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
    gridTexture.wrapS = THREE.RepeatWrapping;
    gridTexture.wrapT = THREE.RepeatWrapping;
    gridTexture.repeat.set(20, 20);

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
}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onPointerMove(event) {

    if(canInteract){
        pointer.set((event.clientX / window.innerWidth) * 2 - 1, - (event.clientY / window.innerHeight) * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObjects(collisionObjects); //objects[] contains the plane
    
        if (intersects.length > 0) {
    
            const intersect = intersects[0];    //intersects[] contains the intersection data
    
            switch(currentMouseMode)    //Switch for mouse modes
            {
                case mouseMode.areaDef:
                    flagRollOverMesh.visible = true;
                    flagRollOverMesh.position.copy(intersect.point).add(intersect.face.normal);
                    if(world.plane.snapToGrid) flagRollOverMesh.position.divideScalar( gridSnapFactor/4 ).floor().multiplyScalar( gridSnapFactor/4 ).addScalar( gridSnapFactor/8 );
    
                    break;
                case mouseMode.objectPlace:
                    flagRollOverMesh.visible = false;
                    objectRolloverMesh.visible = true;
    
                    objectRolloverMesh.position.copy(intersect.point).add(intersect.face.normal);
                    if(world.plane.snapToGrid) objectRolloverMesh.position.divideScalar( gridSnapFactor/4 ).floor().multiplyScalar( gridSnapFactor/4 ).addScalar( gridSnapFactor/8 );
                    objectRolloverMesh.scale.set(currentObjectScale,currentObjectScale,currentObjectScale);  //Set scale
                    objectRolloverMesh.rotation.y = THREE.Math.degToRad(currentObjectRotation);  //Set rotation
                    objectRolloverMesh.position.y -= 1; 
                    
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
            if(flagRollOverMesh != null) flagRollOverMesh.visible = false;      //Removes the rollover mesh when the pointer isnt in a valid position
            if(objectRolloverMesh != null) objectRolloverMesh.visible = false;
        }
    }
    
}

function onPointerDown(event) {

    if(canInteract){
        switch(currentMouseMode)    //Master switch for mouse mode
        {
            case mouseMode.areaDef:         //Area definition mode
                
                switch (event.which){   ////Mouse button switch 
                    case 1: //Left click area definition
                    if (!outlineFinished) {
    
                        pointer.set((event.clientX / window.innerWidth) * 2 - 1, - (event.clientY / window.innerHeight) * 2 + 1);
                        raycaster.setFromCamera(pointer, camera);
                        const intersects = raycaster.intersectObjects(collisionObjects);
        
                        if (intersects.length > 0) {    //If ray intersects with something
        
                            const intersect = intersects[0];
                            if (collisionObjects.includes(intersect.object)){    //if intersect is included in the objects array
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
                                    if(world.plane.snapToGrid) node.position.divideScalar( gridSnapFactor/4 ).floor().multiplyScalar( gridSnapFactor/4 ).addScalar( gridSnapFactor/8 );   //Adds grid snapping if checked
                                    scene.add(node);        //Add the node to the scene
                                    //node.position.y -= 1;
        
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
                    const intersects = raycaster.intersectObjects(collisionObjects); //objects[] contains the plane
    
                    if (intersects.length > 0) {    //If ray intersects with something
    
                        const intersect = intersects[0];
                        if (collisionObjects.includes(intersect.object)){    //if intersect is included in the objects array
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
    
                                if(world.plane.snapToGrid) placableObject.position.divideScalar( gridSnapFactor/4 ).floor().multiplyScalar( gridSnapFactor/4 ).addScalar( gridSnapFactor/8 );   //Adds grid snapping if checked
                                placableObject.scale.set(currentObjectScale,currentObjectScale,currentObjectScale);  //Set scale
                                placableObject.rotation.y = THREE.Math.degToRad(currentObjectRotation);  //Set rotation
                                scene.add(placableObject);        //Add the object to the scene
    
                                placableObject.name = currentObject;
    
                                if(placableObject.name == "Pot" || placableObject.name == "Square raised"){
                                    collisionObjects.push(placableObject);    //If obj is to be used to stack, add to collision array
                                    console.log("Pushed object:" + placableObject.name + " to collisionObjects");
                                } 
                                else {
                                    placedObjects.push(placableObject);               //if obj is not to be collided with, add to array of objs
                                    console.log("Pushed object:" + placableObject.name + " to placedObjects");
                                }
                                spawnSound.play();
                            });
                        }
                        if(isMoving) {
                            changeMouseMode(mouseMode.objectMove); 
                            isMoving = false;
                            objectRolloverMesh.visible = false;
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
    
}

function onDocumentKeyDown(event) {

    switch (event.keyCode) {
        /////Arrow keys//////
        case 38:    //Arrow up - scale up
            currentObjectScale += 0.5; 
            console.log("Scale changed to: " + currentObjectScale);
            break; 
        case 40:    //Arrow down - scale down
            currentObjectScale -= 0.5; 
            if(currentObjectScale < 0 ) currentObjectScale = 0.5;
            console.log("Scale changed to: " + currentObjectScale);
            break; 
        case 37:  //Arrow left - -rotation
            currentObjectRotation -= 5;
            if(currentObjectRotation <0 ) currentObjectRotation = 360;  //Loops rotation 
            console.log("Rotation changed to: " + currentObjectRotation);
            break; 
        case 39:  //Arrow right - +rotation
            currentObjectRotation += 5;
            if(currentObjectRotation > 360 ) currentObjectRotation = 0;
            console.log("Rotation changed to: " + currentObjectRotation);
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
        case 85:    //u - export scene
            exportScene();
            break;
    }

    objectRolloverMesh.scale.set(currentObjectScale,currentObjectScale,currentObjectScale);  //Set scale
    objectRolloverMesh.rotation.y = THREE.Math.degToRad(currentObjectRotation);  //Set rotation
}

function onDocumentKeyUp(event) {

    switch (event.keyCode) {
        case 16: isShiftDown = false; break;    //shift
    }
}

function render() {

    requestAnimationFrame(render);
    controls.update();

    if(world.lights.sunCycleActive && !world.lights.flatLighting)     //If the sun cycle is active
    {
        if(!clock.running) clock.start();
        timestamp = clock.getElapsedTime() * world.lights.timeScale *0.1;
        sunPosition.position.set(Math.cos(timestamp)*world.lights.orbitRadius,  //Set sunPos
         Math.sin(timestamp) * world.lights.orbitRadius *1.5,       //*1.5 offsets vertical orbit slightly, makes for a steeper orbit
         Math.sin(timestamp) * world.lights.orbitRadius);

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

        if(sunSphere.position.y <= -15) sunSphere.visible = false;
        else sunSphere.visible = true;
        if(moonSphere.position.y <= -15) moonSphere.visible = false;
        else moonSphere.visible = true;
    }
    else {
        if(clock.running) clock.stop();
        hemiLight.intensity = 0.4; //If sun cycle isn't active, default to 0.4 intensity
    }

    if(exportSuccess)   //Export confirm appears for a couple of seconds
    {
        confirmExport.style.visibility = "visible";
        confirmExportTimer += clock.getDelta();
        console.log(confirmExportTimer);
        if(confirmExportTimer > 0.004)
        {
            confirmExport.style.visibility = "hidden";
            exportSuccess = false;
            confirmExportTimer = 0;
        }
    }

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
        objectRolloverMesh.visible = false;
    });

}

function changeMouseMode(mode)
{
    switch(mode)
    {
        case mouseMode.none:
            currentMouseMode = mouseMode.none;
            flagRollOverMesh.visible = false;
            document.getElementById("current-tool").innerHTML = " = none";
            break;
        case mouseMode.areaDef:
            currentMouseMode = mouseMode.areaDef;
            flagRollOverMesh.visible = true;
            document.getElementById("current-tool").innerHTML = " = create area";
            break;
        case mouseMode.objectPlace:
            currentMouseMode = mouseMode.objectPlace;
            flagRollOverMesh.visible = false;
            document.getElementById("current-tool").innerHTML = " = place object";
            break;
        case mouseMode.objectRemove:
            currentMouseMode = mouseMode.objectRemove;
            flagRollOverMesh.visible = false;
            document.getElementById("current-tool").innerHTML = " = remove object";
            break;
        case mouseMode.objectMove:
            currentMouseMode = mouseMode.objectMove;
            flagRollOverMesh.visible = false;
            document.getElementById("current-tool").innerHTML = " = move object";
            break;
    }
}}

function exportScene()
{
    hemiLight.visible = false;
    flagRollOverMesh.visible = false;
    objectRolloverMesh.visible = false;
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
    flagRollOverMesh.visible = true;
    objectRolloverMesh.visible = true;
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