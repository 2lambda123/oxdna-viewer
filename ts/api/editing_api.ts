/**
 * Bits of code that handle structure editing
 */
module edit{
/**
     * Split the elemnt's strand at the element provided
     * @param element Element to split at
     * @returns new strand created in split
     */
    function splitStrand(element: BasicElement): Strand {
        const strand = element.strand,
              sys = strand.system;

        // Splitting a circular strand doesn't make
        // more strands, but it will then no longer
        // be circular.
        if(strand.circular) {
            strand.circular = false;
            return;
        }

        // No need to split if one half will be empty
        if(!element.neighbor5) {
            return;
        }

        // Nucleotides which are after the nick
        const orphans : BasicElement[] = api.trace35(element);

        strand.excludeElements(orphans);

        // Create, fill and deploy new strand
        let newStrand: Strand;
        if (strand.getType() == "Peptide") {
            newStrand = strand.system.createStrand(-strand.system.strands.length - 1)
        }
        else {
            newStrand = strand.system.createStrand(strand.system.strands.length + 1);
        }
        strand.system.addStrand(newStrand);
        let lidCounter = 0
        orphans.forEach(
            (e) => {
                newStrand.addMonomer(e);
                e.lid = lidCounter;
                lidCounter += 1;
                e.updateColor();
            }
        );

        if (strand.label) {
            newStrand.label = `${strand.label}_2`;
            strand.label = `${strand.label}_1`;
        }

        // Update local ids in the remnant strand
        // If there are dummy systems, you need to rebuild
        // anyway and they need static local IDs
        if (tmpSystems.length == 0) {
            let i = 0;
            strand.monomers.forEach ((n) => {
                n.lid = i++;
            });
        }

        sys.callUpdates(['instanceColor']);

        return newStrand;
    }

    export function nick(element: BasicElement){
        let sys = element.getSystem(),
            sid = element.gid - sys.globalStartId;
        if (element.dummySys !== null) {
            sys = element.dummySys
            sid = element.sid;
        }
        // we break connection to the 3' neighbor 
        let neighbor =  element.neighbor3;
        element.neighbor3 = null;
        neighbor.neighbor5 = null;
        splitStrand(element);

        sys.fillVec('bbconScales', 3, sid, [0, 0, 0]);
        sys.bbconnector.geometry["attributes"].instanceScale.needsUpdate = true;
        render(); 
    }

    export function ligate(element1 :BasicElement, element2: BasicElement) {
        let end5: BasicElement,
            end3: BasicElement;
        //find out which is the 5' end and which is 3'
        if (element1.neighbor5 == null && element2.neighbor3 == null) {
            end5 = element1;
            end3 = element2;
        }
        else if (element1.neighbor3 == null && element2.neighbor5 == null) {
            end5 = element2;
            end3 = element1;
        }
        else {
            notify("Please select one nucleotide with an available 3' connection and one with an available 5'");
            return;
        }

        // strand1 will have an open 5' and strand2 will have an open 3' end
        // strand2 will be merged into strand1
        let sys5 = end5.getSystem(),
        sys3 = end3.getSystem(),
        strand1 = end5.strand,
        strand2 = end3.strand;

        // handle strand1 and strand2 not being in the same system
        if (sys5 !== sys3) {
            let tmpSys = new System(tmpSystems.length, 0);
            tmpSys.initInstances(strand2.monomers.length);

            for (let i = 0, len = strand2.monomers.length; i < len; i++) {
                copyInstances(strand2.monomers[i], i, tmpSys)
                strand2.monomers[i].setInstanceParameter('visibility', [0,0,0])
                strand2.monomers[i].dummySys = tmpSys;
                strand2.monomers[i].sid = i;
            }
            sys3.callUpdates(['instanceVisibility'])
            addSystemToScene(tmpSys);
            tmpSystems.push(tmpSys);
        }

        // lets orphan strand2 element
        let bases2 = [...strand2.monomers]; // clone the references to the elements
        strand2.excludeElements(strand2.monomers);
        
        //check that it is not the same strand
        if (strand1 !== strand2) {
            //remove strand2 object 
            strand2.system.removeStrand(strand2);
        }
        else {
            strand1.circular = true;
        }

        // Strand id update
        let strID = 1; 
        sys5.strands.forEach((strand) =>strand.strandID = strID++);
        if (sys3 !== sys5) {
            sys3.strands.forEach((strand) =>strand.strandID = strID++);
        }

        // and add them back into strand1 
        //create fill and deploy new strand 
        let i = end5.lid+1;
        bases2.forEach(
            (n) => {
                strand1.addMonomer(n);
                n.lid = i;
                i++;
            }
        );

        //since strand IDs were updated, we also need to update the coloring
        coloringChanged();

        //connect the 2 element objects 
        end5.neighbor5 = end3;
        end3.neighbor3 = end5;

        //last, add the sugar-phosphate bond
        let p2 = end3.getInstanceParameter3("bbOffsets");
        let xbb = p2.x,
            ybb = p2.y,
            zbb = p2.z;

        let p1 = end5.getInstanceParameter3("bbOffsets");
        let xbbLast = p1.x,
            ybbLast = p1.y,
            zbbLast = p1.z;


        let xsp = (xbb + xbbLast) / 2,
            ysp = (ybb + ybbLast) / 2,
            zsp = (zbb + zbbLast) / 2;

        let spLen = Math.sqrt(Math.pow(xbb - xbbLast, 2) + Math.pow(ybb - ybbLast, 2) + Math.pow(zbb - zbbLast, 2));

        let spRotation = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0), new THREE.Vector3(xsp - xbb, ysp - ybb, zsp - zbb).normalize()
        );

        end3.setInstanceParameter('bbconOffsets', [xsp, ysp, zsp]);
        end3.setInstanceParameter('bbconRotation', [spRotation.w, spRotation.z, spRotation.y, spRotation.x]);
        end3.setInstanceParameter('bbconScales', [1, spLen, 1]);

        sys5.callUpdates(["instanceOffset", "instanceScale", "instanceColor", "instanceRotation", "instanceVisibility"]);
        sys3.callUpdates(["instanceOffset", "instanceScale", "instanceColor", "instanceRotation", "instanceVisibility"]);

        if (tmpSystems.length > 0) {
            tmpSystems.forEach((s) => {
                s.callUpdates(['instanceOffset', 'instanceRotation', 'instanceScale', 'instanceColor', 'instanceVisibility'])
            });
        }
        render();
    }

    /**
     * 
     * @param victims 
     */
    export function deleteElements (victims: BasicElement[]) {
        let needsUpdateList = new Set<System>();
        victims.forEach((e) => {
            let sys: System
            let strand = e.strand;
            if (e.dummySys !== null) {
                sys = e.dummySys;
            }
            else {
                sys = e.getSystem();
            }
            needsUpdateList.add(sys);

            let newStrand: Strand;
            // Split strand if we won't also delete further downstream
            if(e.neighbor3 && !victims.includes(e.neighbor3)) {
                newStrand = splitStrand(e);
            }

            if (e.neighbor3 !== null){
                e.neighbor3.neighbor5 = null;
                e.neighbor3 = null;
            }
            if (e.neighbor5 !== null) {
                // If different systems, we need to update both
                let n5sys = e.neighbor5.dummySys ? e.neighbor5.dummySys : e.neighbor5.getSystem();
                needsUpdateList.add(n5sys);

                e.neighbor5.neighbor3 = null;
                e.neighbor5.setInstanceParameter("bbconScales", [0, 0, 0]);
                e.neighbor5 = null;
            }

            e.toggleVisibility();
            e.strand.excludeElements([e])
            elements.delete(e.gid);
            selectedBases.delete(e);

            // Remove strand(s) if empty
            if(strand.isEmpty()) {
                let s = strand.system;
                s.removeStrand(strand);
                // Remove system if empty
                if(s.isEmpty()) {
                    systems.splice(systems.indexOf(s), 1);
                    sysCount--;
                }
            }
            if(newStrand && newStrand != strand && newStrand && newStrand.isEmpty()) {
                let s = newStrand.system;
                s.removeStrand(newStrand);
                // Remove system if empty
                if(s.isEmpty()) {
                    systems.splice(systems.indexOf(s), 1);
                    sysCount--;
                }
            }
        });

        needsUpdateList.forEach((s:System) => {
            s.callUpdates(['instanceVisibility', 'instanceScale'])
        });
        render();
    }

    /**
     * Add elements from saved instance copies, at specified position
     * @param instCopies Instance copies of elements to add
     * @param pos Intended position of elements center of mass
     */
    export function addElementsAt(instCopies: InstanceCopy[], pos?: THREE.Vector3): BasicElement[] {
        // Add elems
        let elems = addElements(instCopies);

        if (pos) {
            // Calculate elems center of mass
            let com = new THREE.Vector3();
            elems.forEach(e=>{
                let p = e.getInstanceParameter3("cmOffsets");
                com.add(p);
            });
            com.divideScalar(elems.length);

            // Move elements to position
            translateElements(new Set(elems), pos.clone().sub(com));
        }
        return elems;
    }
    /**
     * Add elements from saved instance copies
     * @param instCopies Instance copies of elements to add
     */
    export function addElements(instCopies: InstanceCopy[]): BasicElement[] {
        // Initialize a dummy system to put the monomers in
        const tmpSys = new System(systems.length, 0);
        tmpSys.initInstances(instCopies.length);
        tmpSystems.push(tmpSys);

        let oldgids = instCopies.map(c=>{return c.gid});
        let elems = instCopies.map((c,sid)=>{
            // Create new element
            let e: BasicElement = new c.elemType(undefined, undefined);
            // Give back the old copied gid if it's not already in use,
            // otherwise, create a new one
            if(!elements.has(c.gid)) {
                elements.set(c.gid, e);
            } else {
                elements.push(e);
            }
            c.writeToSystem(sid, tmpSys)
            e.dummySys = tmpSys;
            e.sid = sid;
            e.type = c.type;

            // Assign a picking color
            let idColor = new THREE.Color();
            idColor.setHex(e.gid + 1); //has to be +1 or you can't grab nucleotide 0
            tmpSys.fillVec('bbLabels', 3, sid, [idColor.r, idColor.g, idColor.b]);

            return e;
        });

        addSystemToScene(tmpSys);

        let toLigate = [];

        // Sort out neighbors
        elems.forEach((e, sid)=>{
            let c = instCopies[sid];
            // Add neighbors to new copies in list, or to existing elements
            // if they don't already have neighbors
            if(c.n3gid >= 0) { // If we have a 3' neighbor
                let i3 = oldgids.findIndex(gid=>{return gid == c.n3gid});
                // If the 3' neighbor is also about to be added, we link to
                // the new object instead
                if (i3 >= 0) {
                    e.neighbor3 = elems[i3];
                    elems[i3].neighbor5 = e;
                // Otherwise, if the indicated neighbor exists and we can link
                // the new element to it without overwriting anything
                } else if (
                    elements.has(c.n3gid) &&
                    elements.get(c.n3gid) &&
                    !elements.get(c.n3gid).neighbor5)
                {
                    e.neighbor3 = null;
                    toLigate.push([e, elements.get(c.n3gid)]);
                    //e.neighbor3 = elements.get(c.n3gid);
                    //e.neighbor3.neighbor5 = e;
                // If not, we don't set any neighbor
                } else {
                    e.neighbor3 = null;
                }
            }
            // Same as above, but for 5'
            if(c.n5gid >= 0) { // If we have a 5' neighbor
                let i5 = oldgids.findIndex(gid=>{return gid == c.n5gid});
                // If the 5' neighbor is also about to be added, we link to
                // the new object instead
                if (i5 >= 0) {
                    e.neighbor5 = elems[i5];
                    elems[i5].neighbor3 = e;
                // Otherwise, if the indicated neighbor exists and we can link
                // the new element to it without overwriting anything
                } else if (
                    elements.has(c.n5gid) &&
                    elements.get(c.n5gid) &&
                    !elements.get(c.n5gid).neighbor3)
                {
                    e.neighbor5 = null;
                    toLigate.push([e, elements.get(c.n5gid)]);
                // If not, we don't set any neighbor
                } else {
                    e.neighbor5 = null;
                }
            }
        });

        // Sort out strands
        elems.forEach((e, sid)=>{
            let c = instCopies[sid];
            let sys = c.system;
            // Do we have a strand assigned already?
            if(!e.strand) {
                // Does any of our neighbors know what strand this is?
                let i = e;
                while(!i.strand) { // Look in 3' dir
                    if (i.neighbor3) i = i.neighbor3
                    else break;
                }
                if(!i.strand) { // If nothing, look in 5' dir
                    i = e;
                    while(!i.strand) {
                        if (i.neighbor5) i = i.neighbor5
                        else break;
                    }
                }
                // If we found something
                if (i.strand) {
                    // Add us to the strand
                    i.strand.addMonomer(e);
                } else {
                    // Create a new strand
                    let strand = sys.createStrand(sys.strands.length + 1);
                    sys.addStrand(strand);
                    strand.addMonomer(e);
                }
            }
        });

        // Update bonds
        elems.forEach(e=>{
            // Do we still have a 3' neighbor?
            if(e.neighbor3) {
                // Update backbone bond
                calcsp(e);
            } else {
                // Set explicitly to null
                e.neighbor3 = null;
                // Remove backbone bond
                tmpSys.fillVec('bbconScales', 3, e.sid, [0, 0, 0]);
                tmpSys.bbconnector.geometry["attributes"].instanceScale.needsUpdate = true;
                render();
            }
            if(!e.neighbor5) {
                // Set explicitly to null
                e.neighbor5 = null;
            }
            e.updateColor();
        });

        tmpSys.callUpdates(['instanceColor']);

        toLigate.forEach(p=>{
            ligate(p[0], p[1]);
        });

        return elems;
    }

    function addElementsBySeq (end, sequence, tmpSys, direction, inverse, lidCounter): BasicElement[] {
        // add monomers to the strand
        const strand: Strand = end.strand;
        const lines = end.extendStrand(sequence.length, inverse);
        let last = end;

        let addedElems = [];
        //create topology
        for (let i = 0, len = sequence.length; i < len; i++) {
            let e = strand.createBasicElement(undefined);
            elements.push(e); // Add element and assign gid
            e.lid = lidCounter;
            e.sid = lidCounter; //You're always adding to a tmpSys so this is needed
            e.dummySys = tmpSys;
            last[direction] = e;
            e[inverse] = last;
            e.type = sequence[i];
            strand.addMonomer(e);
            last = e;
            lidCounter++;
            addedElems.push(e);
        }
        // Make last element end of strand
        last[direction] = null;
        let e: BasicElement = end[direction];
        //position new monomers
        for (let i = 0, len = sequence.length; i < len; i++) {
            e.calculatePositions(lines[i]);
            e = e[direction];
        }
        strand.circular = false

        addSystemToScene(tmpSys);
        //putting this in one loop would slow down loading systems
        //would require dereferencing the backbone position of every nucleotide
        //its not worth slowing down everything to avoid this for loop
        //which is much more of an edge case anyway.
        e = end;
        while (e && e[direction]) {
            // Backbone must be drawn from 5' end
            if (direction == "neighbor5") {
                calcsp(e.neighbor5);
            } else {
                calcsp(e);
            }
            e = e[direction];
        }

        return addedElems;
    }

    /**
     * Create new monomers extending from the provided one.
     * @param end 
     * @param sequence 
     */
    export function extendStrand(end: BasicElement, sequence: string): BasicElement[] {
        // figure out which way we're going
        let direction: string;
        let inverse: string;
        if (end.neighbor5 == null) {
            direction = "neighbor5";
            inverse = "neighbor3";
        }
        else if (end.neighbor3 == null) {
            direction = "neighbor3";
            inverse = "neighbor5";
        }
        else {
            notify("Please select a monomer that has an open neighbor");
            return
        }

        // initialize a dummy system to put the monomers in
        const tmpSys = new System(tmpSystems.length, 0);
        tmpSys.initInstances(sequence.length);
        tmpSystems.push(tmpSys);

        let addedElems = addElementsBySeq (end, sequence, tmpSys, direction, inverse, 0);

        render();
        return addedElems;
    }

    export function setSequence(elems: Nucleotide[], sequence: string, setComplementaryBases?: boolean) {
        setComplementaryBases = setComplementaryBases || false;
        if (elems.length != sequence.length) {
            notify(`You have ${elems.length} particles selected and ${sequence.length} letters in the sequence...doing my best`);
        }

        // Sort elements by their id, in 5' to 3' order
        elems.sort((a,b)=>{return a.lid<b.lid ? 1:-1});

        // Define a function to satisfy longCalculation callback
        let set = function(){
            let len = Math.min(elems.length, sequence.length);
            for(let i=0; i<len; i++) {
                elems[i].changeType(sequence[i]);
                if (setComplementaryBases) {
                    let paired = elems[i].pair;
                    if(paired) {
                        paired.changeType(elems[i].getComplementaryType());
                    }
                }
            }
            for (let i = 0; i < systems.length; i++) {
                systems[i].nucleoside.geometry["attributes"].instanceColor.needsUpdate = true;
            }
            render();
        }

        // If we need to find basepairs, do that first and wait
        // for the calculation to finish. Otherwise, set the
        // sequence immediately.
        if (setComplementaryBases && !elems[0].isPaired()) {
            longCalculation(findBasepairs, basepairMessage, set);
        } else {
            set();
        }
    }

    /**
     * Creates a new strand with the provided sequence
     * @param sequence
     */
    export function createStrand(sequence: string, isRNA?: Boolean) {
        if (sequence.includes('U')) {
            isRNA = true;
        }
        // Assume the input sequence is 5' -> 3',
        // but oxDNA is 3' -> 5', so we reverse it.
        let tmp:string[] = sequence.split(""); 
        tmp = tmp.reverse(); 
        sequence = tmp.join("");

        // Initialize a dummy system to put the monomers in 
        const tmpSys = new System(tmpSystems.length, 0);
        tmpSys.initInstances(sequence.length);
        tmpSystems.push(tmpSys);

        // The strand gets added to the last-added system.
        // Or make a new system if you're crazy and trying to build something from scratch
        let realSys;
        if (systems.length > 0) {
            realSys = systems.slice(-1)[0];
        }
        else {
            realSys = new System(sysCount++, elements.getNextId())
            realSys.initInstances(0);
            systems.push(realSys);
            addSystemToScene(realSys);
            // This is ugly, but if we don't have a box, everything will be
            // squashed into the origin when centering.
            box = new THREE.Vector3(1000,1000,1000);
        }

        // Create a new strand
        let strand = realSys.createStrand(1);
        realSys.addStrand(strand);

        // Initialise proper nucleotide
        let e = isRNA ?
            new RNANucleotide(undefined, strand):
            new DNANucleotide(undefined, strand);

        let addedElems = [];

        elements.push(e); // Add element and assign gid
        e.dummySys = tmpSys;
        e.lid = 0;
        e.sid = 0;
        e.type = sequence[0];
        e.neighbor3 = null;
        strand.addMonomer(e);
        addedElems.push(e);

        // Place the new strand 10 units in front of the camera
        // with its a1 vector parallel to the camera heading
        // and a3 the cross product of the a1 vector and the camera's up vector
        let cameraHeading = new THREE.Vector3(0, 0, -1);
        cameraHeading.applyQuaternion(camera.quaternion);
        let pos = camera.position.clone().add(cameraHeading.clone().multiplyScalar(20))
        let a3 = new THREE.Vector3;
        a3.crossVectors(cameraHeading, camera.up)
        let line = [pos.x, pos.y, pos.z, cameraHeading.x, cameraHeading.y, cameraHeading.z, a3.x, a3.y, a3.z] as unknown as string[]
        e.calculatePositions(line);
        e.dummySys = tmpSys;

        // Extends the strand 3'->5' with the rest of the sequence
        // and return all added elements.
        return addedElems.concat(
            addElementsBySeq(e, sequence.substring(1), tmpSys, "neighbor5", "neighbor3", 1)
        );
    }

    /**
     * Copies the instancing data from a particle to a new system
     * @param source Element to copy from
     * @param id The element's system ID
     * @param destination Destination system
     */
    function copyInstances(source:BasicElement, id:number, destination:System) {
        destination.fillVec('cmOffsets', 3, id, source.getInstanceParameter3('cmOffsets').toArray());
        destination.fillVec('bbOffsets', 3, id, source.getInstanceParameter3('bbOffsets').toArray()); 
        destination.fillVec('nsOffsets', 3, id, source.getInstanceParameter3('nsOffsets').toArray());
        destination.fillVec('nsRotation', 4, id, source.getInstanceParameter4('nsRotation').toArray()); 
        destination.fillVec('conOffsets', 3, id, source.getInstanceParameter3('conOffsets').toArray()); 
        destination.fillVec('conRotation', 4, id, source.getInstanceParameter4('conRotation').toArray()); 
        destination.fillVec('bbconOffsets', 3, id, source.getInstanceParameter3('bbconOffsets').toArray()); 
        destination.fillVec('bbconRotation', 4, id, source.getInstanceParameter4('bbconRotation').toArray()); 
        destination.fillVec('bbColors', 3, id, source.getInstanceParameter3('bbColors').toArray()); 
        destination.fillVec('scales', 3, id, source.getInstanceParameter3('scales').toArray()); 
        destination.fillVec('nsScales', 3, id, source.getInstanceParameter3('nsScales').toArray()); 
        destination.fillVec('conScales', 3, id, source.getInstanceParameter3('conScales').toArray()); 
        destination.fillVec('bbconScales', 3, id, source.getInstanceParameter3('bbconScales').toArray()); 
        destination.fillVec('visibility', 3, id, source.getInstanceParameter3('visibility').toArray()); 
        destination.fillVec('nsColors', 3, id, source.getInstanceParameter3('nsColors').toArray()); 
        destination.fillVec('bbLabels', 3, id, source.getInstanceParameter3('bbLabels').toArray()); 
    }

}