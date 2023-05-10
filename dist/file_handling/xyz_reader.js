function readXYZString(s) {
    let sys = new System(sysCount, elements.getNextId());
    let lines = s.split(/[\n]+/g);
    // trim blank lines at the end of the file 
    while (lines.length > 0 && lines[lines.length - 1] === "") {
        lines.pop();
    }
    sys.initInstances(lines.length);
    systems.push(sys);
    sysCount++;
    lines.forEach((l, i) => {
        let str = sys.addNewGenericSphereStrand();
        let e = str.createBasicElement(i);
        e.sid = i;
        let split_line = l.split(' ');
        e.calcPositionsFromConfLine(split_line);
        e.type = 'A';
        elements.push(e);
    });
    addSystemToScene(sys);
}
