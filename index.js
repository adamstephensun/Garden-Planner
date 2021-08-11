import * as THREE from "https://unpkg.com/three@0.126.1/build/three.module.js";

import { OrbitControls } from "https://unpkg.com/three@0.126.1/examples/jsm/controls/OrbitControls.js";
import { ConvexGeometry } from "https://unpkg.com/three@0.126.1/examples/jsm/geometries/ConvexGeometry.js";
import { GUI } from "https://unpkg.com/three@0.126.1/examples/jsm/libs/dat.gui.module.js";
import { GLTFLoader } from "https://unpkg.com/three@0.126.1/examples/jsm/loaders/GLTFLoader.js";

//#region declarations
let camera, scene, renderer, controls, gui, world;
let planeMesh;
let pointer, raycaster;

let grassTexture, grassNormal, soilTexture, soilNormal, gravelTexture, gravelNormal, stoneTexture, stoneNormal;
let grassMaterial, soilMaterial, gravelMaterial, stoneMaterial;

let rollOverMesh, rollOverMaterial;
let nodeID;
let outlineGeo, outlineMaterial;
let areaGeo, areaID, areaHeightOffset;
let outlineFinished = new Boolean;

const objects = [];
const nodes = [];
const outlinePoints = [];

const areaTypes = { grass: 'Grass', soil: 'Soil', gravel: 'Gravel', stone: 'Stone' };

const placableObjects = {
    trees:{
        tree1: "Tree 1",
        tree2: "Tree 2",
        tree3: "Tree 3"
    },
    bushes:{
        bush1: "Bush 1",
        bush2: "Bush 2",
        bush3: "Bush 3"
    },
    furniture:{
        benches:{
            bench1: "Bench 1",
            bench2: "Bench 2",
            bench3: "Bench 3"
        }
    }
}

const mouseMode = {
    areaDef: "Area definition",
    objectPlace: "Object place",
    objectRemove: "Object remove",
    objectMove: "Object move"
}

let currentMouseMode = mouseMode.areaDef;

let currentObject = placableObjects.trees.tree1;

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
    renderer.shadowMap.type = THREE.BasicShadowMap;

    document.body.appendChild(renderer.domElement);
    outlineFinished = false;
    nodeID = 0;
    areaID = 0;
    areaHeightOffset = 0;

    loadTextures();

    //#endregion renderer and scene setup

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
                currentMouseMode = mouseMode.areaDef;
                resetOutline();
            },
            type: "Grass",
            finishArea: function(){
                finalOutline();
            }
        },
        objects:{
            place: function(){
                currentMouseMode = mouseMode.objectPlace;
            },
            remove: function(){
                currentMouseMode = mouseMode.objectRemove;
            },
            move: function(){
                currentMouseMode = mouseMode.objectMove;
            },
            trees:{
                tree1: function(){
                    currentObject = placableObjects.trees.tree1;
                },
                tree2: function(){
                    currentObject = placableObjects.trees.tree2;
                },
                tree3: function(){
                    currentObject = placableObjects.trees.tree3;
                }
            },
            furniture:{
                bench1: function(){
                    currentObject = placableObjects.benches.bench1;
                },
                bench2: function(){
                    currentObject = placableObjects.benches.bench2;
                },
                bench3: function(){
                    currentObject = placableObjects.benches.bench3;
                }
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
    //planeFolder.open();

    const areaFolder = gui.addFolder("Area");       //Area folder added
    areaFolder.add(world.area, "type").options(areaTypes).  //Add area type dropdown selector
        onChange(() => {
            console.log(world.areaTypes.type);
        });
    areaFolder.add(world.area, "createNew").name("New area");
    areaFolder.add(world.area,"finishArea").name("Finish area");
    //areaFolder.open();

    const objectFolder = gui.addFolder("Objects");
    objectFolder.add(world.objects, "place").name("Place");
    objectFolder.add(world.objects, "remove").name("Remove");
    objectFolder.add(world.objects, "move").name("Move");

    const treeFolder = objectFolder.addFolder("Trees");
    treeFolder.add(world.objects.trees, "tree1").name("Tree 1");

    const furnitureFolder = objectFolder.addFolder("Furniture");
    furnitureFolder.add(world.objects.furniture, "bench1").name("Bench 1");

    objectFolder.open();

    let tree;

    const treeMat = new THREE.MeshToonMaterial();

    new GLTFLoader().load('models/tree1.gltf', function(gltf){
        tree = gltf.scene;
        tree.traverse(function(child){
            if(child instanceof THREE.Mesh){
                //child.material = treeMat;
            }
        })

        tree.scale.set(20,20,20);
        scene.add(tree);
    });
    

    //#endregion GUI

    //#region camera controls

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.set(50, 80, 130);
    camera.lookAt(0, 0, 0);

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
    //#endregion camera controls

    //#region spheres

    //////roll-over sphere/////

    const rollOverGeo = new THREE.SphereGeometry(1, 32, 32);
    rollOverMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, opacity: 0.5, transparent: true });
    rollOverMesh = new THREE.Mesh(rollOverGeo, rollOverMaterial);
    scene.add(rollOverMesh);

    //#endregion spheres

    //#region raycast

    raycaster = new THREE.Raycaster();
    pointer = new THREE.Vector2();

    //#endregion raycast

    //#region plane & grid


    const planeGeo = new THREE.PlaneGeometry(100, 100);
    planeGeo.rotateX(- Math.PI / 2);

    planeMesh = new THREE.Mesh(planeGeo, grassMaterial);
    planeMesh.recieveShadow = true;
    planeMesh.name = "plane";
    scene.add(planeMesh);

    objects.push(planeMesh);

    //#endregion plane & grid

    //#region lights

    const ambientLight = new THREE.AmbientLight(0x606060);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff);
    directionalLight.position.set(1, 0.75, 0.5).normalize();
    directionalLight.castShadow = true;

    directionalLight.shadow.mapSize.width = 512;
    directionalLight.shadow.mapSize.height = 512;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;

    scene.add(directionalLight);

    /*const sphereGeometry = new THREE.SphereGeometry( 5, 32, 32 );
    const sphereMaterial = new THREE.MeshStandardMaterial( { color: 0xfff000 } );
    const sphere = new THREE.Mesh( sphereGeometry, sphereMaterial );
    sphere.castShadow = true; //default is false
    sphere.receiveShadow = false; //default
    scene.add( sphere );*/

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
                break;
            case 2: //Middle click
                break;
            case 3: //right click
                break;
        }

            break;
    }

    switch (event.which) {
        case 1: //left click
            break;
        case 2: //middle mouse
            break;
        case 3: //right mouse
            break;
    }
}

function onDocumentKeyDown(event) {

    switch (event.keyCode) {
        case 13: finalOutline(); break; //Enter
        case 16: isShiftDown = true; break; //Shift
        case 82: resetOutline(); break; //R
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
    if (outlinePoints.length > 2) { //If it is a triangle or more (>2 points)
        console.log("Final outline");
        outlinePoints.push(new THREE.Vector3(outlinePoints[0].x, outlinePoints[0].y, outlinePoints[0].z)); //Add a duplicate of the first point to the end of the array to make it a complete area
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
        areaMesh.position.y -= 0.9 - areaHeightOffset; //Makes the area level (just above) the plane
        areaHeightOffset += 0.005;  //Height offset is increased slightly each area generated to avoid z fighting

        for(let i in nodes)
        {
            console.log("Removed element: " + i.toString());
            scene.remove(scene.getObjectByName("node "+i));
        }
    }
    nodeID = 0; //Reset the node id counter so the next set of nodes can be deleted
    scene.remove(scene.getObjectByName("outline"));
}

function resetOutline() {
    for (let i in nodes) {
        scene.remove(nodes[i].object);
        console.log("Removed element: " + i.toString());
        scene.remove(scene.getObjectByName("node "+i));
    }
    nodes.length = 0;
    outlinePoints.length = 0;

    outlineFinished = false;
}