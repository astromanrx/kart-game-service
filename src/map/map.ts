import * as islandMapData from "./OurIsland.json"


interface Point{
    x: number;
    y: number;
    z: number;
}

// Add two points
const addPoints = (a: Point, b: Point): Point => ({
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
});

// Subtract two points
const subtractPoints = (a: Point, b: Point): Point => ({
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z,
});

// Multiply a point by a scalar
const multiplyPointByScalar = (point: Point, scalar: number): Point => ({
    x: point.x * scalar,
    y: point.y * scalar,
    z: point.z * scalar,
});

// Divide a point by a scalar
const dividePointByScalar = (point: Point, scalar: number): Point => ({
    x: scalar !== 0 ? point.x / scalar : 0, // Avoid division by zero
    y: scalar !== 0 ? point.y / scalar : 0,
    z: scalar !== 0 ? point.z / scalar : 0,
});

// Calculate the center between two points using addPoints and divide by scalar
const calculateCenter = (a: Point, b: Point): Point => {
    const sum = addPoints(a, b);
    return dividePointByScalar(sum, 2);
};

// Calculate the extents from two points using subtractPoints and divide by scalar
const calculateExtents = (a: Point, b: Point): Point => {
    const difference = subtractPoints(b, a);
    const div = dividePointByScalar(difference, 2);
    return {
        x: Math.abs(div.x),
        y: Math.abs(div.y),
        z: Math.abs(div.z),
    };
};

const calculateMovementAABB = (points: Point[],minSize: number): AABB => {
    if(points.length < 2){
        throw new Error("Can't calculate AABB for less than 2 points");
    }
    let min:Point = {
        x: points[0].x,
        y: points[0].y,
        z: points[0].z,
    },max:Point = {
        x: points[0].x,
        y: points[0].y,
        z: points[0].z
    } ;
    for(let i=1;i<points.length;i++){
        const pt = points[i]
        if(pt.x < min.x)
            min.x = pt.x;
        if(pt.y < min.y)
            min.y = pt.y;
        if(pt.z < min.z)
            min.z = pt.z;
        if(pt.x > max.x)
            max.x = pt.x;
        if(pt.y > max.y)
            max.y = pt.y;
        if(pt.z > max.z)
            max.z = pt.z;
    }
    const center: Point = {
        x: (min.x + max.x) * 0.5,
        y: (min.y + max.y) * 0.5,
        z: (min.z + max.z) * 0.5,
    };

    return {
        center,
        extents: {
            x: Math.max(Math.abs(center.x - max.x),minSize),
            y: Math.max(Math.abs(center.y - max.y),minSize),
            z: Math.max(Math.abs(center.z - max.z),minSize),
        }
    }

};



interface AABB{
    center: Point;
    extents: Point;
}

interface NavData{
    indices: Array<number>;
    vertices: Array<Point>;
}

interface MapData{
    checkpoints: Array<AABB>;
    finishLap: AABB;
    startLap: AABB;
    navmesh: NavData;
    laps: number;
}

const IsOverlap = (first: AABB, second: AABB): boolean => {
    // Calculate the minimum and maximum points for the first AABB
    const firstMin = {
        x: first.center.x - first.extents.x,
        y: first.center.y - first.extents.y,
        z: first.center.z - first.extents.z,
    };

    const firstMax = {
        x: first.center.x + first.extents.x,
        y: first.center.y + first.extents.y,
        z: first.center.z + first.extents.z,
    };

    // Calculate the minimum and maximum points for the second AABB
    const secondMin = {
        x: second.center.x - second.extents.x,
        y: second.center.y - second.extents.y,
        z: second.center.z - second.extents.z,
    };

    const secondMax = {
        x: second.center.x + second.extents.x,
        y: second.center.y + second.extents.y,
        z: second.center.z + second.extents.z,
    };

    // Check for overlap in all three dimensions
    const collideX = firstMax.x >= secondMin.x && firstMin.x <= secondMax.x;
    const collideY = firstMax.y >= secondMin.y && firstMin.y <= secondMax.y;
    const collideZ = firstMax.z >= secondMin.z && firstMin.z <= secondMax.z;

    return collideX && collideY && collideZ;
};

interface Checkpoint{
    index: number;
}


class Map{
    private _data: MapData;

    constructor(data: MapData){
        this._data = data;
    }

    IsOverlapCheckpoint(oldPosition: Point,newPosition: Point): Checkpoint | false{        
        const movementAABB :AABB = calculateMovementAABB([oldPosition,newPosition],0.5)

        for(let i=0;i<this._data.checkpoints.length;i++){
            const checkpointAABB = this._data.checkpoints[i];             
            if(IsOverlap(movementAABB,checkpointAABB)){
                return <Checkpoint>{
                    index:i
                };
            }
        }
        return false
    }

    IsOverlapFinish(oldPosition: Point,newPosition: Point): boolean{
        const movementAABB :AABB = calculateMovementAABB([oldPosition,newPosition],0.5)

        return IsOverlap(movementAABB,this._data.finishLap)        
    }

    IsOverlapStart(oldPosition: Point,newPosition: Point): boolean{
        const movementAABB :AABB = calculateMovementAABB([oldPosition,newPosition],0.5)

        return IsOverlap(movementAABB,this._data.startLap)        
    }

    getCheckpointsNum():number{
        return this._data.checkpoints.length;
    }

    getLapsNum():number{
        return this._data.laps;
    }
}

const IslandMap = new Map(islandMapData);


export {IsOverlap,type Point, type AABB, Map,Checkpoint, IslandMap }


