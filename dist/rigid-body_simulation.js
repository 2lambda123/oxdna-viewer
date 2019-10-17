// Global variable for simulator
let rigidClusterSimulator;
/**
 * Start rigid-body simulator if it's not already running
 */
function toggleClusterSim() {
    if (!document.getElementById("clusterSim")["checked"]) {
        rigidClusterSimulator = null;
        return;
    }
    if (!rigidClusterSimulator) {
        rigidClusterSimulator = new RigidClusterSimulator();
        if (rigidClusterSimulator.getNumberOfClusters() < 2) {
            notify("Please create at least 2 clusters");
            document.getElementById("clusterOptions").hidden = false;
            document.getElementById("clusterSim")["checked"] = false;
            rigidClusterSimulator = null;
            return;
        }
    }
    rigidClusterSimulator.simulate();
}
// http://www.cs.cmu.edu/~baraff/sigcourse/notesd1.pdf
// https://www.toptal.com/game/video-game-physics-part-i-an-introduction-to-rigid-body-dynamics
/**
 *  Put spring forces on the backbone connections that connect the clusters,
 *  as well as a repulsive force at the centre of each cluster, then simulate
 *  the system with rigid-body dynamics.
 */
class RigidClusterSimulator {
    constructor() {
        this.clusters = [];
        this.clusterRepulsionConst = 1000;
        // Create Cluster objects for each cluster label among the elements
        let m = new Map();
        elements.forEach((e) => {
            let c = e.clusterId;
            if (c < 0) {
                return; // Ignore cluster noise
            }
            if (!m.has(c)) {
                m.set(c, new Set());
            }
            m.get(c).add(e);
        });
        m.forEach((clusterElements) => {
            this.clusters.push(new Cluster(clusterElements));
        });
    }
    ;
    getNumberOfClusters() {
        return this.clusters.length;
    }
    /**
     * Simulate one timestep (of length dt)
     * @param dt Timestep length
     */
    integrate(dt) {
        this.clusters.forEach((c) => {
            // Calculate spring forces between inter-cluster backbone bonds
            c.computeConnectionForces();
            // Calculate repulsion between clusters
            this.clusters.forEach((other) => {
                if (c !== other) {
                    let f = c.getPosition().sub(other.getPosition());
                    let dist = f.length();
                    let scalar = Math.max(this.clusterRepulsionConst * (1 - (dist / (c.getRadius() + other.getRadius()))), 0);
                    f.setLength(scalar);
                    c.addForce(f);
                }
            });
        });
        // Integrate for each cluster
        this.clusters.forEach((c) => {
            c.integrate(dt);
        });
    }
    ;
    /**
     * Start simulation and run while checbox is checked
     */
    simulate() {
        this.integrate(0.1);
        let shouldContinue = document.getElementById("clusterSim")["checked"];
        if (shouldContinue) {
            requestAnimationFrame(this.simulate.bind(this));
        }
        else {
            editHistory.add(new RevertableClusterSim(this.clusters));
            console.log("Added simulation result to edit history");
        }
    }
    ;
}
class Cluster {
    /**
     * Create a rigid-body cluster from the given set of elements
     * @param clusterElements Set of BasicElements making up the cluster
     */
    constructor(clusterElements) {
        this.conPoints = [];
        this.elementMass = 0.01;
        this.connectionRelaxedLength = 1;
        this.connectionSpringConst = 5;
        this.friction = 0.25;
        this.linearVelocity = new THREE.Vector3(); // v
        this.angularVelocity = new THREE.Vector3(); // ω,  Direction is rot axis, magnitude is rot velocity
        this.totalTranslation = new THREE.Vector3();
        this.totalRotation = new THREE.Quaternion();
        this.clusterElements = clusterElements;
        this.mass = clusterElements.size * this.elementMass;
        this.calculateCenter();
        this.radius = 0;
        clusterElements.forEach((e) => {
            let p = e.getInstanceParameter3("cmOffsets");
            this.radius = Math.max(this.radius, p.distanceTo(this.position));
        });
        // http://scienceworld.wolfram.com/physics/MomentofInertiaSphere.html
        this.momentOfInertia_inv = new THREE.Matrix3(); // Identity matrix
        this.momentOfInertia_inv.multiplyScalar(5 / (2 * this.mass * Math.pow(this.radius, 2)));
        clusterElements.forEach((e) => {
            if (e.neighbor3 && e.neighbor3.clusterId !== e.clusterId) {
                this.conPoints.push(new ClusterConnectionPoint(e, e.neighbor3));
            }
            if (e.neighbor5 && e.neighbor5.clusterId !== e.clusterId) {
                this.conPoints.push(new ClusterConnectionPoint(e, e.neighbor5));
            }
        });
        // Initialize forces
        this.force = new THREE.Vector3();
        this.torque = new THREE.Vector3();
    }
    ;
    /**
     * Set cluster position to the center of mass of it's elements
     */
    calculateCenter() {
        this.position = new THREE.Vector3();
        this.clusterElements.forEach((e) => {
            this.position.add(e.getInstanceParameter3("cmOffsets"));
        });
        this.position.divideScalar(this.clusterElements.size);
    }
    getPosition() {
        return this.position.clone();
    }
    getRadius() {
        return this.radius;
    }
    getTotalTranslation() {
        return this.totalTranslation.clone();
    }
    getTotalRotation() {
        return this.totalRotation.clone();
    }
    getElements() {
        return this.clusterElements;
    }
    /**
     * Calculate spring forces between inter-cluster backbone bonds
     */
    computeConnectionForces() {
        this.conPoints.forEach((p) => {
            let scalar = this.connectionSpringConst * (p.getDist() - this.connectionRelaxedLength);
            let f = p.getToPos().clone().sub(p.getFromPos());
            f.setLength(scalar);
            this.addForce(f, p.getFromPos());
        });
    }
    ;
    /**
     * Integrate one time-step and update cluster position and orientation
     * depending on the forces that act upon it.
     * @param dt Timestep length
     */
    integrate(dt) {
        // Position needs to be updated if the cluster is dragged manually
        if (getActionModes().includes("Drag")) {
            this.calculateCenter();
        }
        // Calculate translation
        let linearMomentum = this.force.clone().divideScalar(this.mass);
        this.linearVelocity.add(linearMomentum.clone().multiplyScalar(dt));
        this.linearVelocity.multiplyScalar(1 - this.friction);
        let deltaP = this.linearVelocity.clone().multiplyScalar(dt);
        this.position.add(deltaP);
        // Calculate rotation
        let angularMomentum = this.torque.clone().applyMatrix3(this.momentOfInertia_inv);
        this.angularVelocity.add(angularMomentum.clone().multiplyScalar(dt));
        this.angularVelocity.multiplyScalar(1 - this.friction);
        let deltaO = this.angularVelocity.clone().multiplyScalar(dt);
        // Perform transformations
        translateElements(this.clusterElements, deltaP);
        let rotAngle = deltaO.length();
        let rotAxis = deltaO.normalize();
        rotateElements(this.clusterElements, rotAxis, rotAngle, this.position);
        this.totalTranslation.add(deltaP);
        let tempQ = new THREE.Quaternion();
        tempQ.setFromAxisAngle(rotAxis, rotAngle);
        this.totalRotation.premultiply(tempQ);
        // Clear forces
        this.force = new THREE.Vector3();
        this.torque = new THREE.Vector3();
    }
    ;
    /**
     * Apply a force to the cluster, optionally at a given point to add torque
     * @param f Force to apply
     * @param r (optional) position at which to apply f (applied at centre-of-mass if not given)
     */
    addForce(f, r) {
        this.force.add(f);
        if (r) {
            // Calculate torque
            let t = (r.clone().sub(this.position)).cross(f);
            // Add to local torque
            this.torque.add(t);
        }
    }
    ;
}
/**
 * Cluster helper class, defines a connection between clusters
 */
class ClusterConnectionPoint {
    constructor(from, to) {
        this.from = from;
        this.to = to;
    }
    ;
    getFromPos() {
        return this.from.getInstanceParameter3("cmOffsets").clone();
    }
    getToPos() {
        return this.to.getInstanceParameter3("cmOffsets").clone();
    }
    getDist() {
        return this.getFromPos().distanceTo(this.getToPos());
    }
}
