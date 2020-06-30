function drawSystemHierarchy() {
    let checkboxhtml = (label) => `<input data-role="checkbox" data-caption="${label}">`;
    const includeMonomers = document.getElementById("hierarchyMonomers").checked;
    var frag = document.createDocumentFragment();
    const content = document.getElementById("hierarchyContent");
    content.innerText = '';
    let hierarchy = Metro.makePlugin(content, "treeview", {
        onCheckClick: (state, check, node, tree) => {
            let n = $(node);
            let element = n.data('monomer');
            if (element) {
                if (check.checked) {
                    element.select();
                }
                else {
                    element.deselect();
                }
                updateView(element.getSystem());
                return;
            }
            let strand = n.data('strand');
            if (strand) {
                if (check.checked) {
                    strand.select();
                }
                else {
                    strand.deselect();
                }
                updateView(strand.system);
                return;
            }
            let system = n.data('system');
            if (system) {
                if (check.checked) {
                    system.select();
                }
                else {
                    system.deselect();
                }
                updateView(system);
                return;
            }
        },
        showChildCount: true
    });
    let treeview = hierarchy.data('treeview');
    let checkboxMap = new Map();
    // Add checkbox nodes for, systems, strands and monomers
    for (const system of systems) {
        let systemNode = treeview.addTo(null, {
            html: checkboxhtml(system.label ? system.label : `System ${system.systemID}`)
        });
        systemNode.data('system', system);
        for (const strand of system.strands) {
            let strandNode = treeview.addTo(systemNode, {
                html: checkboxhtml(strand.label ? strand.label : `Strand ${strand.strandID} (${strand.monomers.length})`)
            });
            strandNode.data('strand', strand);
            if (includeMonomers) {
                let addMonomer = (monomer) => {
                    let color = monomer.elemToColor(monomer.type).getHexString();
                    let monomerNode = treeview.addTo(strandNode, {
                        html: checkboxhtml(`gid: ${monomer.gid}`.concat(monomer.label ? ` (${monomer.label})` : "")) +
                            `<span style="background:#${color}4f; padding: 5px">${monomer.type}</span>`
                    });
                    monomerNode.data('monomer', monomer);
                    // Save reference for checbox in map:
                    let checkbox = monomerNode.find("input")[0];
                    checkbox.checked = selectedBases.has(monomer);
                    checkboxMap.set(monomer.gid, checkbox);
                };
                for (const [i, monomer] of strand.monomers.entries()) {
                    if (i < 20) {
                        addMonomer(monomer);
                    }
                    else {
                        let moreNode = treeview.addTo(strandNode, {
                            caption: `View remaining ${strand.monomers.length - i} monomers`,
                            icon: '<span class="mif-plus"></span>'
                        });
                        moreNode[0].onclick = () => {
                            treeview.del(moreNode);
                            for (let j = i; j < strand.monomers.length; j++) {
                                addMonomer(strand.monomers[j]);
                            }
                        };
                        break;
                    }
                }
            }
        }
    }
    //});});});
    treeview._recheck(hierarchy);
    hierarchy.data('checkboxMap', checkboxMap);
    /*
    // Add listeners for if an element is toggled
    document.addEventListener('elementSelectionEvent', event=>{
        checkboxMap.get(event['element'].gid).checked = event['selected'];
        //treeview._recheck(tv);
    });
    */
}
function handleMenuAction(event) {
    switch (event) {
        case "undo":
            editHistory.undo();
            break;
        case "redo":
            editHistory.redo();
            break;
        case "del":
            deleteWrapper();
            break;
        case "cut":
            cutWrapper();
            break;
        case "copy":
            copyWrapper();
            break;
        case "paste":
            pasteWrapper(false);
            break;
        case "all":
            selectAll();
            break;
        case "invert":
            invertSelection();
            break;
        case "clear":
            clearSelection();
            break;
    }
}
function updateColorPalette() {
    const opt = document.getElementById("colorPaletteContent");
    if (!opt.hidden) {
        opt.innerHTML = ""; //Clear content
        //modifies the backboneColors array
        for (let i = 0; i < backboneColors.length; i++) {
            let m = backboneColors[i];
            let c = document.createElement('input');
            c.type = 'color';
            c.value = "#" + m.getHexString();
            c.onchange = function () {
                backboneColors[i] = new THREE.Color(c.value);
                updateColorPalette();
            };
            //deletes color on right click
            c.oncontextmenu = function (event) {
                event.preventDefault();
                backboneColors.splice(i, 1);
                updateColorPalette();
                return false;
            };
            opt.appendChild(c);
        }
        //actually update things in the scene
        elements.forEach(e => {
            if (!selectedBases.has(e)) {
                e.updateColor();
            }
        });
        systems.forEach(s => {
            s.callUpdates(['instanceColor']);
        });
        tmpSystems.forEach(s => {
            s.callUpdates(['instanceColor']);
        });
        render();
    }
}
;
function initLutCols(systems) {
    for (let i = 0; i < systems.length; i++) {
        const system = systems[i];
        for (let j = 0; j < system.bbColors.length; j += 3) {
            const r = system.bbColors[j];
            const g = system.bbColors[j + 1];
            const b = system.bbColors[j + 2];
            system.lutCols[j / 3] = new THREE.Color(r, g, b);
        }
    }
}
function resetCustomColoring() {
    view.setColoringMode("Strand");
    initLutCols(systems);
    initLutCols(tmpSystems);
    clearSelection();
}
// create color map with selected color
function colorElements(color, elems) {
    if (!color) {
        let colorInput = document.getElementById("customColor");
        color = new THREE.Color(colorInput.value);
    }
    if (!elems) {
        elems = Array.from(selectedBases);
    }
    if (elems.length == 0) {
        notify("Please first select the elements you wish to color");
    }
    if (lut == undefined) {
        lut = new THREE.Lut(defaultColormap, 512);
        // legend needed to set 'color by' to Overlay, gets removed later
        lut.setLegendOn();
        lut.setLegendLabels();
    }
    else {
        const emptyTmpSystems = tmpSystems.filter(tmpSys => tmpSys.lutCols.length == 0);
        if (emptyTmpSystems.length > 0) {
            console.log(emptyTmpSystems);
            initLutCols(emptyTmpSystems);
        }
        view.setColoringMode("Overlay");
    }
    initLutCols(systems);
    initLutCols(tmpSystems);
    elems.forEach(e => {
        let sid;
        if (e.dummySys) {
            sid = e["gid"] - e.dummySys.globalStartId;
            e.dummySys.lutCols[e.sid] = color;
        }
        sid = e["gid"] - e.getSystem().globalStartId;
        e.getSystem().lutCols[sid] = color;
    });
    view.setColoringMode("Overlay");
    if (!systems.some(system => system.colormapFile)) {
        api.removeColorbar();
    }
    clearSelection();
}
function toggleVisArbitrary() {
    // arbitrary visibility toggling
    // toggle hidden monomers
    if (selectedBases.size == 0) {
        systems.forEach(system => {
            system.strands.forEach(strand => {
                strand.monomers.forEach(monomer => {
                    if (monomer.getInstanceParameter3("visibility").x == 0)
                        monomer.toggleVisibility();
                });
            });
        });
    }
    // toggle selected monomers
    else {
        selectedBases.forEach(e => e.toggleVisibility());
    }
    systems.forEach(sys => sys.callUpdates(['instanceVisibility']));
    tmpSystems.forEach(tempSys => tempSys.callUpdates(['instanceVisibility']));
    clearSelection();
}
function notify(message, type, title) {
    let n = Metro.notify;
    if (!type) {
        type = "info";
    }
    n.create(message, title, {
        cls: type,
        timeout: 5000
    });
    console.info(`Notification: ${message}`);
}
class View {
    constructor(doc) {
        this.basepairMessage = "Locating basepairs, please be patient...";
        this.doc = doc;
    }
    setToggleGroupValue(id, value) {
        let toggleGroup = this.doc.getElementById(id);
        let active = toggleGroup.querySelector('.active');
        if (active) {
            active.classList.remove('active');
        }
        for (let opt of toggleGroup.children) {
            if (opt.querySelector('.caption').innerHTML == value) {
                opt.classList.add('active');
                return;
            }
        }
    }
    getToggleGroupValue(id) {
        return this.doc.getElementById(id).querySelector('.active').querySelector('.caption').innerHTML;
    }
    getRandomHue() {
        return new THREE.Color(`hsl(${Math.random() * 360}, 100%, 50%)`);
    }
    getInputNumber(id) {
        return this.doc.getElementById(id).valueAsNumber;
    }
    getInputValue(id) {
        return this.doc.getElementById(id).value;
    }
    getInputBool(id) {
        return document.getElementById(id).checked;
    }
    isWindowOpen(id) {
        let elem = this.doc.getElementById(id);
        if (elem) {
            // Should work but doesn't
            //return Metro.window.isOpen(elem);
            return elem.parentElement.parentElement.style.display != "none";
        }
        else {
            return false;
        }
    }
    toggleWindow(id, oncreate) {
        let elem = this.doc.getElementById(id);
        if (elem) {
            Metro.window.toggle(elem);
        }
        else {
            this.createWindow(id, oncreate);
        }
    }
    createWindow(id, oncreate) {
        fetch(`windows/${id}.json`)
            .then(response => response.json())
            .then(data => {
            let w = Metro.window.create(data);
            w[0].id = id;
            w.load(`windows/${id}.html`).then(oncreate);
        });
    }
    toggleModal(id) {
        ;
    }
    // nucleotides/strand/system
    getSelectionMode() {
        return this.getToggleGroupValue('selectionScope');
    }
    setSelectionMode(setting) {
        this.setToggleGroupValue('selectionScope', setting);
    }
    selectionEnabled() {
        return this.getSelectionMode() != "Disabled";
    }
    selectPairs() {
        return this.doc.getElementById("selectPairs").checked;
    }
    getCenteringSetting() {
        return this.getToggleGroupValue('centering');
    }
    setCenteringSetting(setting) {
        this.setToggleGroupValue('centering', setting);
    }
    getInboxingSetting() {
        return this.getToggleGroupValue('inboxing');
    }
    setInboxingSetting(setting) {
        return this.setToggleGroupValue('inboxing', setting);
    }
    getTransformSetting() {
        return this.getToggleGroupValue('transform');
    }
    transformEnabled() {
        return this.getTransformSetting() != "None";
    }
    getColoringMode() {
        return this.getToggleGroupValue('coloringMode');
    }
    setColoringMode(mode) {
        this.setToggleGroupValue('coloringMode', mode);
        updateColoring();
    }
    ;
    handleTransformMode(mode) {
        // Make sure that buttons correspond to specified mode
        this.setToggleGroupValue('transform', mode);
        // If we should show something
        if (mode != "None") {
            // Make sure something is selected
            if (selectedBases.size > 0) {
                transformControls.show();
                transformControls.setMode(mode.toLowerCase());
            }
            else {
                notify("Please select elements to transform");
                // Reset buttons to none
                this.setToggleGroupValue('transform', 'None');
            }
        }
        else {
            transformControls.hide();
        }
    }
    longCalculation(calc, message, callback) {
        let activity = Metro.activity.open({
            type: 'square',
            overlayColor: '#fff',
            overlayAlpha: 1,
            text: message
        });
        // Set wait cursor and request an animation frame to make sure
        // that it gets changed before starting calculation:
        let dom = document.activeElement;
        dom['style'].cursor = "wait";
        requestAnimationFrame(() => requestAnimationFrame(() => {
            try {
                calc();
            }
            catch (error) {
                notify(`Sorry, something went wrong with the calculation: ${error}`, "alert");
            }
            // Change cursor back and remove modal
            dom['style'].cursor = "auto";
            Metro.activity.close(activity);
            if (callback) {
                callback();
            }
        }));
    }
}
let view = new View(document);
