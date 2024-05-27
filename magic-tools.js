/*
@summary Magic tools for bipsi.
@license MIT
@author Jean-Sébastien Monzani (base plugin code by CrocMiam)
@version 1.0

@description
Adds new drawing tools to bipsi for easier room creation.

HOW TO USE:
1. Create a new event on any location in your bipsi room, choose import plugin and import magic-tools.js file.
2. Go to Draw tile. A new button with a magic wand appears on the bottom right. 
3. The whole tileset is displayed. Originally, this is for large assets, usually a 16x16 grid of 256 tiles (each being 8x8 pixels).
4. The new drawing tools on top include, from left to right:
- Draw
- Draw filled rectangle
- Stamp: paste tiles from the tileset in their original relative position (useful for elements based on multiple tiles)
- Copy: select a rectangular area
- Paste: copy this rectangle.
- Multiple select/random: when activated, multiple tiles can be selected. Draw and rectangle will then pick randomly from then when drawing. Useful for variations such as flowers on a map.

SUPPORTED OPTIONS: 
The field "magic-options" supports special options in JSON format
- "keepColors": false - works in conjunction with another plugin that imports colored tilesets.
- "experimental":false - some experimental features like multi-frame animation (only works if you haven't created animations and for tilesets with tiles that haven't been manually reordered). Undocumented, unsupported, use at your own risk.

DISCLAIMER:
This plugin is provided as is and without any guarantee of support of any kind.

CODING NOTE:
All my tools coexist with the original from Bipsi, which makes programming a little bit difficult.
To add new tools without modifying the tools' toolbar, I temporarily disable the toolbar by selecting an undefined tool through EDITOR.roomPaintTool.value. This way, no tool radio button is active.
Upon closing my window, the standard tile drawing tool gets reactivated.
*/
//! CODE_EDITOR
wrap.after(BipsiEditor.prototype, "redraw", async function() { //add a box-drawing function for selecting tiles
    if (typeof MAGIC_selecting === 'undefined') return;
    if (MAGIC_selecting) {

        const f = TILE_PX * SCREEN_ZOOM;
        const e = MAGIC_selection;
        rendering = this.renderings.tileMapPaint;
        rendering.strokeStyle = "rgba(255, 100, 100, 1)";
        rendering.lineWidth = 4;
        rendering.strokeRect(e.x0*f, e.y0*f, (e.x1-e.x0+1)*f, (e.y1-e.y0+1)*f);
        
    }
});
const setIfWithin = (map, x, y, value) => {
    if (x >= 0 && x < ROOM_SIZE && y >= 0 && y < ROOM_SIZE) map[y][x] = value ?? 0;
} 
const getIfWithin = (map, x, y) => {
    if (x >= 0 && x < ROOM_SIZE && y >= 0 && y < ROOM_SIZE) return map[y][x];
} 
//! CODE_EDITOR
wrap.after(BipsiEditor.prototype, "onRoomPointer", async function( event, canvas ) {  
    const redraw = () => EDITOR.requestRedraw();
    if (EDITOR.picker.checked) { // if we picked up a color/tile, adjust the magic editor accordingly
        const { tileIndex } = EDITOR.getSelections();
        selectedTiles.splice(0); // removes everything
        selectedTiles.push(tileIndex); //select the picked tile
        redrawExtraTilesCanvas();
        return;
    }

    if (typeof EDITOR.roomPaintTool.value != 'undefined') return;
    if (magicToolsWindow.window.hidden) //The GUI is inactive, don't do anything
        return 

    const { tile, room, data, bgIndex, fgIndex, tileset, colorIndex } = EDITOR.getSelections();
    /* getSelections can return
    { 
            data, 
            tileset, 
            roomIndex, room, 
            paletteIndex, palette, colorIndex,
            tileIndex, tile, frameIndex, tileSize, 
            event, tileFrame,
            fgIndex, bgIndex, fg, bg,
        }
    */
    const factor = ROOM_SIZE / canvas.width;

    const round = (position) => {
        return {
            x: Math.floor(position.x * factor),
            y: Math.floor(position.y * factor),
        };
    };


    const drag = ui.drag(event);
    const positions = trackCanvasStroke(canvas, drag);

    const { x, y } = round(positions[0]);

    function plot(x, y)  {
        if (MAGIC_tool == "stamp") {
            let stampTiles = selectedTiles.map(ts => {
                //find the tile in the EDITOR list as they could have been reordered
                const t = EDITOR.getSelections().data.tiles[ ts ].id;
                let tileinfo = getTileCoords(tileset.canvas, ts); //compute the coordinates in my tileset as it's the visual reference
                tileinfo.x /= TILE_PX;
                tileinfo.y /= TILE_PX;
                tileinfo.tile = t;
                return tileinfo;
            });
            
            let xoffset = Math.min(...stampTiles.map(point => point.x));
            let yoffset = Math.min(...stampTiles.map(point => point.y));                    

            for ({x:xpos, y:ypos,tile:tstamp} of stampTiles) {
                if (EDITOR.placeTile.checked) {
                    setIfWithin(room.tilemap, x+xpos-xoffset, y+ypos-yoffset, tstamp); 
                }
                if (EDITOR.paintBackground.checked) setIfWithin(room.backmap, x+xpos-xoffset, y+ypos-yoffset, bgIndex); 
                if (EDITOR.paintForeground.checked) setIfWithin(room.foremap, x+xpos-xoffset, y+ypos-yoffset, fgIndex); 
            }
        } else {
            if (EDITOR.placeTile.checked) {
                //find the tile in the EDITOR list as they could have been reordered
                const t = EDITOR.getSelections().data.tiles[   selectedTiles[getRandomInt(0, selectedTiles.length)]      ].id;

                setIfWithin(room.tilemap, x, y, t); 
            }
            if (EDITOR.paintBackground.checked) setIfWithin(room.backmap, x, y, bgIndex); 
            if (EDITOR.paintForeground.checked) setIfWithin(room.foremap, x, y, fgIndex); 
        }
    }

    if (MAGIC_tool == "paste-area") {
        EDITOR.stateManager.makeCheckpoint();
        const rectStartX = MAGIC_selection.x0;
        const rectStartY = MAGIC_selection.y0;
        const rectEndX =  MAGIC_selection.x1;
        const rectEndY =  MAGIC_selection.y1;
        for (let xt = rectStartX; xt <= rectEndX; xt++) { 
            for (let yt = rectStartY; yt <= rectEndY; yt++) {

                if (EDITOR.placeTile.checked) setIfWithin(room.tilemap, xt+x-rectStartX, yt+y-rectStartY, getIfWithin(MAGIC_pasteboard.tilemap, xt, yt));
                if (EDITOR.paintBackground.checked) setIfWithin(room.backmap, xt+x-rectStartX, yt+y-rectStartY, getIfWithin(MAGIC_pasteboard.backmap, xt, yt));
                if (EDITOR.paintForeground.checked) setIfWithin(room.foremap, xt+x-rectStartX, yt+y-rectStartY, getIfWithin(MAGIC_pasteboard.foremap, xt, yt));                     
            }
        } 
        redraw();
        EDITOR.stateManager.changed();        
    } else if (MAGIC_tool === "draw" || MAGIC_tool === "stamp") {    
        EDITOR.stateManager.makeCheckpoint();
        plot(x, y);
        redraw();

        drag.addEventListener("move", (event) => {
            const { x: x0, y: y0 } = round(positions[positions.length - 2]);
            const { x: x1, y: y1 } = round(positions[positions.length - 1]);
            lineplot(x0, y0, x1, y1, plot);
            redraw();
        });

        drag.addEventListener("up", (event) => {
            MAGIC_selecting = false;
            const { x, y } = round(positions[positions.length - 1]);
                plot(x, y);
            redraw();
            EDITOR.stateManager.changed();
        });
    } else if (MAGIC_tool === "box") { 
        EDITOR.stateManager.makeCheckpoint();
        drag.addEventListener("move", (event) => {
            const { x:x0, y:y0 } = round(positions[0]); //JSM draw rectangle
            const { x: x1, y: y1 } = round(positions[positions.length - 1]);
            const rectStartX = Math.min(x0, x1);
            const rectStartY = Math.min(y0, y1);
            const rectEndX = Math.max(x0, x1);
            const rectEndY = Math.max(y0, y1);

            MAGIC_selection = {x0: rectStartX, y0: rectStartY, x1: rectEndX, y1: rectEndY };
            MAGIC_selecting = true;
            redraw();
        });

        drag.addEventListener("up", (event) => {
            MAGIC_selecting = false;
            for (let xt = MAGIC_selection.x0; xt <= MAGIC_selection.x1; xt++) { 
                for (let yt = MAGIC_selection.y0; yt <= MAGIC_selection.y1; yt++) {
                    plot(xt, yt);                        
                }
            } 
            redraw();
            EDITOR.stateManager.changed();
        });
    }else if (MAGIC_tool === "copy-area") { 
        drag.addEventListener("move", (event) => {
            const { x:x0, y:y0 } = round(positions[0]); //JSM draw rectangle
            const { x: x1, y: y1 } = round(positions[positions.length - 1]);
            const rectStartX = Math.min(x0, x1);
            const rectStartY = Math.min(y0, y1);
            const rectEndX = Math.max(x0, x1);
            const rectEndY = Math.max(y0, y1);
            MAGIC_selection = {x0: rectStartX, y0: rectStartY, x1: rectEndX, y1: rectEndY };
            MAGIC_selecting = true;
            redraw();
        });

        drag.addEventListener("up", (event) => {
            MAGIC_selecting = false;
            setExtraTool("paste-area"); //after a copy, activate paste-area
        });
    }

});


//! CODE_EDITOR
function autoCloseToggledWindow(windowElement, toggle) {
    window.addEventListener("click", (event) => {
        const target = event.target;

        const ignore = windowElement.hidden ||
            !event.isTrusted ||
            windowElement.contains(target) ||
            toggle.inputs.includes(target) ||
            //don't autofold for these useful icons
            target.id === "tile-map-paint" || target.name === "show-palette-window" || target.name === "show-room-window" ||
            target.name === "show-color-window" || target.name === "tile-picker" || target.name === "place-tile" || target.name === "room-paint-foreground" || target.name === "room-paint-background" ||
            //don't autofold for these useful windows
            target.closest("#color-select-window") || target.closest("#palette-select-window") || target.closest("#room-select-window")

            ;
        
        if (ignore)
            return;
        toggle.checked = false;
    });
}



var imageUp = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-magic" viewBox="0 0 16 16"> <path d="M9.5 2.672a.5.5 0 1 0 1 0V.843a.5.5 0 0 0-1 0zm4.5.035A.5.5 0 0 0 13.293 2L12 3.293a.5.5 0 1 0 .707.707zM7.293 4A.5.5 0 1 0 8 3.293L6.707 2A.5.5 0 0 0 6 2.707zm-.621 2.5a.5.5 0 1 0 0-1H4.843a.5.5 0 1 0 0 1zm8.485 0a.5.5 0 1 0 0-1h-1.829a.5.5 0 0 0 0 1zM13.293 10A.5.5 0 1 0 14 9.293L12.707 8a.5.5 0 1 0-.707.707zM9.5 11.157a.5.5 0 0 0 1 0V9.328a.5.5 0 0 0-1 0zm1.854-5.097a.5.5 0 0 0 0-.706l-.708-.708a.5.5 0 0 0-.707 0L8.646 5.94a.5.5 0 0 0 0 .707l.708.708a.5.5 0 0 0 .707 0l1.293-1.293Zm-3 3a.5.5 0 0 0 0-.706l-.708-.708a.5.5 0 0 0-.707 0L.646 13.94a.5.5 0 0 0 0 .707l.708.708a.5.5 0 0 0 .707 0z"/> </svg>';
var caret = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" fill=\"currentColor\" class=\"bi bi-caret-up-fill\" viewBox=\"0 0 16 16\"><path d=\"m7.247 4.86-4.796 5.481c-.566.647-.106 1.659.753 1.659h9.592a1 1 0 0 0 .753-1.659l-4.796-5.48a1 1 0 0 0-1.506 0z\"/></svg>";

//! CODE_EDITOR
const PLUGIN_NAME = "magic-tools";
//!CONFIG magic-options (json) {"keepColors": false, "experimental":false}
const defaultOptions = {
    keepColors: false, experimental:false
};



const ZOOM_TILE_MAGIC = 3;
let canvas;
let ctx;
const selectedTiles = [];
const tilesheetCols = 16;

let MAGIC_tool = 'draw'; // Default tool
let MAGIC_selecting = false;
let MAGIC_selection = {x0:0,y0:0,x1:0,y1:0};
let MAGIC_pasteboard = {tilemap:[],foremap:[], backmap: []};

let multiselect = false;
let magicToolsWindow;
let magicToolsRadios;
let nbTotalTiles = 0;
const border = 2; // pixels separating tiles in our tileset browser
function setExtraTool(t) { 
    MAGIC_tool = t;
    magicToolsRadios.setValueSilent(t);
}
function checkOptions() {
    try {
        const rawOptions = FIELD(CONFIG, "magic-options", "json");
        if (rawOptions != null && typeof rawOptions === "object") {
            return rawOptions;
        }
        else {
            console.log("Incorrect magic-options");
            return defaultOptions;
        }
    }
    catch (e) {
        console.log("Incorrect magic-options");
        return defaultOptions;
    }
}

function handleClick(event) {
    let canvasRect = canvas.getBoundingClientRect();
    const x = event.clientX - canvasRect.left;
    const y = event.clientY - canvasRect.top;
    const tileX = Math.floor(x / (border + TILE_PX* ZOOM_TILE_MAGIC));
    const tileY = Math.floor(y / (border + TILE_PX* ZOOM_TILE_MAGIC));

    const index = tileY * (ROOM_SIZE) + tileX;
    if (index>=nbTotalTiles) { //undefined tile
        return;
    }

    if (multiselect) {
        if (selectedTiles.includes(index)) {
            const selectedIndex = selectedTiles.indexOf(index);
            selectedTiles.splice(selectedIndex, 1);
        } else {
            selectedTiles.push(index);
        }        
    } else { //only select one
        selectedTiles.splice(0); // removes everything
        selectedTiles.push(index);        
    }
    if (checkOptions()["experimental"]) console.log("Selected tiles: ", selectedTiles); 
    EDITOR.tileBrowser.selectedTileIndex = index;    
    redrawExtraTilesCanvas();
}

function tileRealCoord(tx, ty) {
    const x = tx * (border + TILE_PX * ZOOM_TILE_MAGIC);
    const y = ty * (border + TILE_PX * ZOOM_TILE_MAGIC);
    const sizefinal = TILE_PX * ZOOM_TILE_MAGIC;
    return {x:x,y:y,size:sizefinal};
}

function redrawExtraTilesCanvas() {
    //ctx.clearRect(0, 0, canvas.width, canvas.height);
    const isColor = checkOptions()["keepColors"];
    const { bg,fg,data, tileset} = EDITOR.getSelections();    
    nbTotalTiles = data.tiles.length;
    const magicTilesCanvas = tileset.canvas;

    if (isColor) {
        // color mode, simply show the tileset
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        data.tiles.forEach(({ frames }, i) => {
            const index =  frames[0]; //frames[frame] ?? frames[0];
            const tx = i % tilesheetCols;
            const ty = Math.floor(i / tilesheetCols);
            const { x, y, size } = getTileCoords(magicTilesCanvas, index);
            const {x:xdest, y:ydest, size:sizedest} = tileRealCoord(tx,ty);
            ctx.drawImage(
                magicTilesCanvas,
                x, y, size, size, 
                xdest, ydest,sizedest,sizedest
            );
        });        

    } else {
        const backpg = createRendering2D(canvas.width, canvas.height); 
        const colorpg = createRendering2D(canvas.width, canvas.height);
        const tilespg = createRendering2D(canvas.width, canvas.height);

        //canvas.style.background = bg; 
        
        backpg.fillStyle = bg;
        backpg.fillRect(0, 0, canvas.width, canvas.height);
        colorpg.fillStyle = fg;
        colorpg.fillRect(0, 0, canvas.width, canvas.height);

        

        data.tiles.forEach(({ frames }, i) => {
            const index =  frames[0]; //frames[frame] ?? frames[0];

            const tx = i % tilesheetCols;
            const ty = Math.floor(i / tilesheetCols);
            const { x, y, size } = getTileCoords(magicTilesCanvas, index);
            const {x:xdest, y:ydest, size:sizedest} = tileRealCoord(tx,ty);
            tilespg.drawImage(
                magicTilesCanvas,
                x, y, size, size, 
                xdest, ydest,sizedest,sizedest
            );

        });
        backpg.globalCompositeOperation = "destination-out";
        backpg.drawImage(tilespg.canvas, 0, 0);
        backpg.globalCompositeOperation = "source-over";
    
        colorpg.globalCompositeOperation = "destination-in";
        colorpg.drawImage(tilespg.canvas, 0, 0);
        colorpg.globalCompositeOperation = "source-over";        

        ctx.drawImage(backpg.canvas, 0, 0);
        ctx.drawImage(colorpg.canvas, 0, 0);
    }
    
    selectedTiles.forEach(index => {
        //const x = (index % (canvas.width / (TILE_PX * ZOOM_TILE_MAGIC))) * TILE_PX * ZOOM_TILE_MAGIC;
        //const y = Math.floor(index / (canvas.width / (TILE_PX * ZOOM_TILE_MAGIC))) * TILE_PX * ZOOM_TILE_MAGIC;
        const tx = index % ROOM_SIZE; 
        const ty = Math.floor(index / ROOM_SIZE);
        ctx.strokeStyle = "rgba(255, 100, 100, 1)";
        ctx.lineWidth = 4;
        const {x, y, size} = tileRealCoord(tx,ty);
        ctx.strokeRect(x + 2, y + 2, size - 3, size - 3);
    });
}


function setupEditorPlugin() {
    // Prevent repeating this setup
    EDITOR.loadedEditorPlugins ?? (EDITOR.loadedEditorPlugins = new Set());
    EDITOR.loadedEditorPlugins.add(PLUGIN_NAME);
    // Create a togglable window
    magicToolsWindow = createToggleWindow({
        windowId: "magic-tools-window",
        toggleId: "magic-tools-toggle",
        inputTitle: "magic tools",
        inputName: "show-magic-tools",
        windowContent: `
        <div class="viewport-toolbar">
            <div class="horizontal-capsule radio-select" style="flex:5">
                    <label>
                        <input title="draw" type="radio" name="magic-tool" value="draw" checked=""><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pencil" viewBox="0 0 16 16"> <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325"/> </svg>
                    </label>
                    <label>
                        <input title="draw rectangle" type="radio" name="magic-tool" value="box"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-aspect-ratio" viewBox="0 0 16 16"> <path d="M0 3.5A1.5 1.5 0 0 1 1.5 2h13A1.5 1.5 0 0 1 16 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 12.5zM1.5 3a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5z"/> <path d="M2 4.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1H3v2.5a.5.5 0 0 1-1 0zm12 7a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1 0-1H13V8.5a.5.5 0 0 1 1 0z"/> </svg>
                    </label>
                    <label>
                        <input  title="stamp" type="radio" name="magic-tool" value="stamp"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" version="1.1" id="Stamp--Streamline-Plump">
                        <path d="M7.6080000000000005 0.9462079999999999C7.205808 0.95736 6.736384 0.99472 6.516432 1.033072C5.982512 1.1261759999999998 5.491728 1.44856 5.182512 1.90928C4.884368 2.353504 4.769216 2.82504 4.813696 3.419632C4.877136 4.26792 5.236448 7.9112 5.285520000000001 8.203984C5.290640000000001 8.234464000000001 5.281488 8.242528 5.225776 8.256752C4.366768 8.476016 2.51824 9.060096 2.239072 9.200464C1.855536 9.393296000000001 1.5556800000000002 9.671968000000001 1.335664 10.040000000000001C1.178848 10.302336 1.1136320000000002 10.508352 1.044448 10.96C0.985936 11.342 0.9829600000000001 11.706608000000001 1.0368 11.896C1.149888 12.293856 1.4329760000000002 12.645168 1.787936 12.828224L1.903856 12.888 1.9039359999999999 13.017904000000001C1.904224 13.582 2.2076160000000002 14.172272000000001 2.673648 14.515440000000002C2.98184 14.742384 3.285904 14.854608 3.704 14.895728C4.918432 15.015152 6.946832000000001 15.077088 8.868 15.053376C10.414192 15.034304 12.153568 14.941104 12.582976 14.854336C13.433520000000001 14.682464 14.096 13.877696 14.096 13.016335999999999L14.096 12.884864 14.163632 12.854432000000001C14.53184 12.688736 14.842864 12.315824000000001 14.962976000000001 11.896C15.055871999999999 11.571312 14.969263999999999 10.735488 14.798032 10.304C14.617456 9.848976 14.229232 9.43592 13.760736000000001 9.200368000000001C13.474752 9.056576 11.707360000000001 8.498288 10.774224 8.256976C10.71856 8.242576 10.709376 8.234432000000002 10.714448 8.203984C10.763520000000002 7.9098559999999996 11.123327999999999 4.261552 11.186304 3.419632C11.231056 2.8214560000000004 11.11648 2.3560160000000003 10.812528 1.90128C10.692512 1.7217120000000001 10.454016 1.478704 10.283888000000001 1.362608C10.12416 1.253632 9.869616 1.13264 9.692703999999999 1.081616C9.334575999999998 0.978336 8.471376000000001 0.922256 7.6080000000000005 0.9462079999999999M7.448 1.953824C7.086912000000001 1.97224 6.696912 2.012608 6.592656 2.042336C6.136016 2.172544 5.808 2.633424 5.808 3.144784C5.808 3.3374720000000004 5.908176 4.474912000000001 6.0489120000000005 5.88C6.12296 6.6193599999999995 6.267504 7.979888 6.281376000000001 8.068L6.2908159999999995 8.128 7.99936 8.128L9.707904000000001 8.128 9.717407999999999 8.068C9.732032 7.97552 9.879472 6.595152000000001 9.951088 5.88C10.089504000000002 4.498016 10.192 3.3378560000000004 10.192 3.153152C10.192 2.6340320000000004 9.866672000000001 2.173312 9.407712 2.0424480000000003C9.230784 1.991984 8.40608 1.933616 7.937648 1.938384C7.809152 1.93968 7.5888 1.9466400000000001 7.448 1.953824M5.6160000000000005 9.193056C4.681296000000001 9.433584000000002 2.915216 9.983312 2.677008 10.107872C2.3968000000000003 10.2544 2.2136 10.460624 2.1170560000000003 10.73824C2.0713600000000003 10.869664 2.000144 11.331567999999999 2.000064 11.497152C1.999984 11.640704 2.0335840000000003 11.739104 2.113776 11.830208C2.1932959999999997 11.92056 2.3116480000000004 11.978896 2.456 11.99888C2.700192 12.032704 3.742016 12.098064 4.5120000000000005 12.127856C6.371424 12.199824000000001 9.628575999999999 12.199824000000001 11.488 12.127856C12.257984 12.098064 13.299808 12.032704 13.544 11.99888C13.688352000000002 11.978896 13.806704 11.92056 13.886224 11.830208C13.965808 11.739808000000002 14 11.640864 14 11.501024C14 11.373696 13.945248 10.962784 13.909904000000001 10.824928C13.830768 10.516208 13.610672000000001 10.248144 13.317328 10.103200000000001C13.051616000000001 9.971904 11.319568 9.4344 10.404112 9.19912L10.096224000000001 9.120000000000001 7.996112 9.120496L5.896 9.120992000000001 5.6160000000000005 9.193056M2.912192 13.087568C2.9128960000000004 13.239488 3.0238240000000003 13.469856 3.165232 13.613072C3.3826080000000003 13.833264 3.508016 13.875024 4.083968 13.919024C5.050608 13.992863999999999 5.784576 14.025456 7.0360000000000005 14.050144000000001C8.646944 14.08192 10.400352000000002 14.034799999999999 11.916032 13.919024C12.491984 13.875024 12.617392 13.833264 12.834768 13.613072C12.976176 13.469856 13.087104 13.239488 13.087808 13.087568L13.088000000000001 13.047136 12.932 13.058512C11.78344 13.142336 10.150848 13.183808 8 13.183808C5.849152 13.183808 4.21656 13.142336 3.068 13.058512L2.912 13.047136 2.912192 13.087568" stroke="none" fill="currentColor" fill-rule="evenodd"></path>
                    </svg>
                    </label>
                    <label>
                        <input title="copy area"  type="radio" name="magic-tool" value="copy-area"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-box-arrow-in-down-right" viewBox="0 0 16 16"> <path fill-rule="evenodd" d="M6.364 2.5a.5.5 0 0 1 .5-.5H13.5A1.5 1.5 0 0 1 15 3.5v10a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 2 13.5V6.864a.5.5 0 1 1 1 0V13.5a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5v-10a.5.5 0 0 0-.5-.5H6.864a.5.5 0 0 1-.5-.5"/> <path fill-rule="evenodd" d="M11 10.5a.5.5 0 0 1-.5.5h-5a.5.5 0 0 1 0-1h3.793L1.146 1.854a.5.5 0 1 1 .708-.708L10 9.293V5.5a.5.5 0 0 1 1 0z"/> </svg>
                    </label>
                    <label>
                    <input title="paste area"  type="radio" name="magic-tool" value="paste-area"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-box-arrow-down-right" viewBox="0 0 16 16"> <path fill-rule="evenodd" d="M8.636 12.5a.5.5 0 0 1-.5.5H1.5A1.5 1.5 0 0 1 0 11.5v-10A1.5 1.5 0 0 1 1.5 0h10A1.5 1.5 0 0 1 13 1.5v6.636a.5.5 0 0 1-1 0V1.5a.5.5 0 0 0-.5-.5h-10a.5.5 0 0 0-.5.5v10a.5.5 0 0 0 .5.5h6.636a.5.5 0 0 1 .5.5"/> <path fill-rule="evenodd" d="M16 15.5a.5.5 0 0 1-.5.5h-5a.5.5 0 0 1 0-1h3.793L6.146 6.854a.5.5 0 1 1 .708-.708L15 14.293V10.5a.5.5 0 0 1 1 0z"/> </svg>
                    </label>
            </div>
            <label  class="toggle">
                <input  title="select multiple tiles" type="checkbox" id="multi"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-ui-checks-grid" viewBox="0 0 16 16">  <path d="m11,10c-.55,0-1,.45-1,1v3c0,.55.45,1,1,1h3c.55,0,1-.45,1-1v-3c0-.55-.45-1-1-1h-3Zm-2,1c0-1.1.9-2,2-2h3c1.1,0,2,.9,2,2v3c0,1.1-.9,2-2,2h-3c-1.1,0-2-.9-2-2v-3ZM0,2C0,.9.9,0,2,0h3c1.1,0,2,.9,2,2v3c0,1.1-.9,2-2,2h-3c-1.1,0-2-.9-2-2v-3Zm5.35.85c.2-.2.2-.51,0-.71-.2-.2-.51-.2-.71,0l-1.65,1.65-.65-.65c-.2-.2-.51-.2-.71,0s-.2.51,0,.71h0l1,1c.2.2.51.2.71,0,0,0,0,0,0,0l2-2Zm3.65-.85c0-1.1.9-2,2-2h3c1.1,0,2,.9,2,2v3c0,1.1-.9,2-2,2h-3c-1.1,0-2-.9-2-2v-3Zm5.35.85c.2-.2.2-.51,0-.71-.2-.2-.51-.2-.71,0l-1.65,1.65-.65-.65c-.2-.2-.51-.2-.71,0s-.2.51,0,.71h0l1,1c.2.2.51.2.71,0,0,0,0,0,0,0l2-2ZM0,11C0,9.9.9,9,2,9h3c1.1,0,2,.9,2,2v3c0,1.1-.9,2-2,2h-3C.9,16,0,15.1,0,14v-3Zm5.35.85c.2-.2.2-.51,0-.71-.2-.2-.51-.2-.71,0l-1.65,1.65-.65-.65c-.2-.2-.51-.2-.71,0s-.2.51,0,.71h0l1,1c.2.2.51.2.71,0,0,0,0,0,0,0l2-2Z"/></svg>
              </svg>
            </label>
            <button  title="animate selected tiles" name="animate" style="display:none"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-camera-reels" viewBox="0 0 16 16"> <path d="M6 3a3 3 0 1 1-6 0 3 3 0 0 1 6 0M1 3a2 2 0 1 0 4 0 2 2 0 0 0-4 0"/> <path d="M9 6h.5a2 2 0 0 1 1.983 1.738l3.11-1.382A1 1 0 0 1 16 7.269v7.462a1 1 0 0 1-1.406.913l-3.111-1.382A2 2 0 0 1 9.5 16H2a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zm6 8.73V7.27l-3.5 1.555v4.35zM1 8v6a1 1 0 0 0 1 1h7.5a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1"/> <path d="M9 6a3 3 0 1 0 0-6 3 3 0 0 0 0 6M7 3a2 2 0 1 1 4 0 2 2 0 0 1-4 0"/> </svg>
        </div>
        <div style="overflow: hidden scroll;">
            <canvas id="canvas" ></canvas>
        </div>
`,//width:${TILE_PX * ROOM_SIZE * ZOOM_TILE_MAGIC}px; height: ${TILE_PX * ROOM_SIZE * ZOOM_TILE_MAGIC}px;
        toggleContent: `
        ${imageUp}
        ${caret}
      `,
    });
    canvas = ONE('#canvas', magicToolsWindow.window);
    magicToolsWindow.window.style.height = "508px";    
    magicToolsWindow.window.style.zIndex  = "98";    //as the window is sticky, put it below the color selector, palette editor

    ctx = canvas.getContext('2d');
    ctx.canvas.width = TILE_PX * ROOM_SIZE * ZOOM_TILE_MAGIC + ROOM_SIZE *border;
    ctx.canvas.height = TILE_PX * ROOM_SIZE * ZOOM_TILE_MAGIC + ROOM_SIZE *border;
    ctx.imageSmoothingEnabled = false;


    redrawExtraTilesCanvas();
    canvas.addEventListener('click', handleClick);

    ONE("#controls").append(magicToolsWindow.window);
    ONE("#draw-room-tab-controls .viewport-toolbar").append(magicToolsWindow.button);

    EDITOR.roomPaintTool.tab(magicToolsWindow.button, "tile");
    const toolsRadios = ALL('input[name="magic-tool"]', magicToolsWindow.window);  
    magicToolsRadios = ui.radio("magic-tool");
    toolsRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            MAGIC_tool = this.value;
            if (MAGIC_tool == "copy-area") {
                const {room} = EDITOR.getSelections();
                function deepCopyArrayOfArrays(array) {
                    return array.map(subArray => [...subArray]);
                }
                // copy the current room to the pasteboard
                MAGIC_pasteboard = {tilemap: deepCopyArrayOfArrays(room.tilemap), 
                    foremap: deepCopyArrayOfArrays(room.foremap), 
                    backmap: deepCopyArrayOfArrays(room.backmap)};
                EDITOR.roomPaintTool.setValueSilent("undefined"); // activates an unexisting tool so that drawing doesn't happen         
            }
            EDITOR.roomPaintTool.setValueSilent("undefined"); // activates an unexisting tool so that drawing doesn't happen         

        });
    });    

    const multiButton = ONE('#multi', magicToolsWindow.window);
    multiButton.addEventListener("click",  () => {
        multiselect = ONE('#multi', magicToolsWindow.window).checked;
        if (!multiselect) {
            if (selectedTiles.length > 1) {
                selectedTiles.length = 0; // removes everything 
                EDITOR.tileBrowser.selectedTileIndex = -1; 
            }            
        } 
        redrawExtraTilesCanvas();
    });    

    const animateButton = ONE('[name="animate"]', magicToolsWindow.window);
    animateButton.addEventListener("click",  () => {
        let anim = selectedTiles.slice(); //slice creates a copy
        const {  data } = EDITOR.getSelections();
        let i = 0;
        for (tile of selectedTiles) {
            data.tiles[tile].frames =  anim.slice(i).concat(anim.slice(0, i));
            i++;
            //anim.push(anim.shift()); // should work but doesn't, who knows why
        }
    });


    //EDITOR.renderings.tileMapPaint.canvas.addEventListener("pointerdown", (event) => onRoomPointerExtra(event, EDITOR.renderings.tileMapPaint.canvas));
    EDITOR.showColorSelect.addEventListener("change", () => {
        redrawExtraTilesCanvas();
    });

}
if (!EDITOR.loadedEditorPlugins?.has(PLUGIN_NAME)) {
    setupEditorPlugin();
}
function createToggleWindow({ windowId, toggleId, inputName, inputTitle, toggleContent, windowContent, }) {
    const windowEl = document.createElement("div");
    windowEl.id = windowId;
    windowEl.className = "popup-window";
    windowEl.hidden = true;
    windowEl.innerHTML = windowContent;
    const toggleButtonEl = document.createElement("label");
    toggleButtonEl.id = toggleId;
    toggleButtonEl.className = "toggle picker-toggle";
    toggleButtonEl.hidden = true;
    toggleButtonEl.innerHTML = `
    <input type="checkbox" name="${inputName}" title="${inputTitle}">
    ${toggleContent}
  `;
    // bipsi's ui.toggle requires the element to be in the DOM
    // so we directly use the CheckboxWrapper
    const toggle = new CheckboxWrapper(ALL(`[name="${inputName}"]`, toggleButtonEl));
    toggle?.addEventListener("change", () => {
        windowEl.hidden = !toggle.checked;
        if (windowEl.hidden) {
            EDITOR.roomPaintTool.setValueSilent("tile"); // activates the regular tile paint tool
        } else {
            if (checkOptions()["experimental"]) {
                const animateButton = ONE('[name="animate"]', magicToolsWindow.window);
                animateButton.style.display = "flex";
            }
            EDITOR.roomPaintTool.setValueSilent("undefined"); // activates an unexisting tool so that drawing doesn't happen         
        }

    });
    autoCloseToggledWindow(windowEl, toggle);
    return {
        window: windowEl,
        button: toggleButtonEl,
        toggle,
    };
}
