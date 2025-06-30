// AirplanePhysics.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
export class AirplanePhysics {
	constructor(aircraftObject) {
		this.aircraft = aircraftObject;
		this.velocity = new THREE.Vector3(0, 0, 0);
		this.mass = 2500;
		this.wingArea = 20;
		this.spring_stiffness = 1000;
		this.damping_coeff = 7500;
		this.rest_length = 0.3;
		this.rho = 1.225;
		this.gravityAccel = -9.81;
		this.ClMax = 1.5;
		this.Cl0 = 0.2;
		this.Cla = 5.7;
		this.Cd0 = 0.02;
		this.k = 0.06;
		this.pitchRate = 0.5;
		this.yawRate = 0.3;
		this.rollRate = 0.7;
	}
	getAoA() {
		const forward = new THREE.Vector3(0, 1, 0).applyQuaternion(this.aircraft.quaternion);
		const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.aircraft.quaternion);
		const velNorm = this.velocity.clone().normalize();
		const angle = forward.angleTo(velNorm);
		const sign = Math.sign(velNorm.dot(forward.clone().cross(right)));
		return angle * sign;
	}
	getLiftCoefficient(alpha) {
		const zeroLiftOffset = THREE.MathUtils.degToRad(2);
		const alphaShifted = alpha + zeroLiftOffset;
		const a0 = 1.4;
		const alpha0 = THREE.MathUtils.degToRad(10);
		const cl = a0 * Math.sin(2 * alphaShifted) * (1 - Math.exp(-Math.pow(alphaShifted / alpha0, 2)));
		return cl
	}
	getDragCoefficient(Cl) {
		return this.Cd0 + this.k * Cl * Cl;
	}
	getLiftForce(Cl) {
		const vMag = this.velocity.length();
		const liftMagnitude = 0.5 * this.rho * vMag * vMag * this.wingArea * Cl;
	
		// Use aircraft's local up vector (usually Z+)
		const liftDir = new THREE.Vector3(0, 0, 1).applyQuaternion(this.aircraft.quaternion).normalize();

		return liftDir.multiplyScalar(liftMagnitude);
	}
	getDragForce(Cd) {
		const vMag = this.velocity.length();
		const dragMagnitude = 0.5 * this.rho * vMag * vMag * this.wingArea * Cd;
		const dragDir = this.velocity.clone().normalize().negate();
		return dragDir.multiplyScalar(dragMagnitude);
	}
	getThrustForce(thrustInput, isOnGround) {
		const forward = new THREE.Vector3(0, 1, 0).applyQuaternion(this.aircraft.quaternion);
		return forward.multiplyScalar(thrustInput);
	}
	getGravityForce(onGround) {
		if (onGround) {
			return new THREE.Vector3(0, 0, 0);
		} else {
			return new THREE.Vector3(0, 0, this.gravityAccel * this.mass);
		}
	}
	applyLandingGearForce(groundDistance) {
		const compression = this.rest_length - groundDistance;
		if (compression <= 0) return new THREE.Vector3(0, 0, 0);
		const verticalVelocity = this.velocity.z;
		const springForce = this.spring_stiffness * compression;
		const dampingForce = this.damping_coeff * verticalVelocity;
		const totalForce = springForce - dampingForce;
		return new THREE.Vector3(0, 0, totalForce);
	}
	applyControls(pitchInput, yawInput, rollInput, dt = 1, test = false) {
		this.minControlSpeed ??= 10;
		this.maxControlSpeed ??= 120;
		const speed = this.velocity.length();
		const speedFactor = THREE.MathUtils.clamp(
			(speed - this.minControlSpeed) / (this.maxControlSpeed - this.minControlSpeed),
			0,
			1
		);
		const effectiveness = speedFactor * speedFactor;
		if (!test) {
			this.aircraft.rotateX(pitchInput * this.pitchRate * effectiveness * dt);
			this.aircraft.rotateZ(yawInput * this.yawRate * effectiveness * dt);
			this.aircraft.rotateY(rollInput * this.rollRate * effectiveness * dt);
		} else if (test === 'x') {
			return(pitchInput * this.pitchRate * effectiveness * dt)
		} else if (test === 'z') {
			return(yawInput * this.yawRate * effectiveness * dt)
		} else if (test === 'y') {
			return(rollInput * this.rollRate * effectiveness * dt)
		}
	}
	update(thrustInput, groundDistance = null, dt = 1, braking = false) {
		const isOnGround = groundDistance !== null && groundDistance <= 0.025;
		const isReasonablyOnGround = groundDistance !== null && groundDistance <= 0.2;
		const alpha = this.getAoA();
		const Cl = this.getLiftCoefficient(alpha);
		const Cd = this.getDragCoefficient(Cl);
		const lift = this.getLiftForce(Cl);
		const drag = this.getDragForce(Cd);
		const thrust = this.getThrustForce(thrustInput, isReasonablyOnGround);
		const gravity = this.getGravityForce(isOnGround);
		const directionalForce = new THREE.Vector3()
			.add(thrust)
			.add(drag);
		const directionalAccel = directionalForce.clone().divideScalar(this.mass);
		if (!this.direction_based) this.direction_based = new THREE.Vector3();
		this.direction_based.add(directionalAccel.multiplyScalar(dt));
		// lerp
		const forward = new THREE.Vector3(0, 1, 0).applyQuaternion(this.aircraft.quaternion);
		const currentSpeed = this.direction_based.length();
		const realignStrength = 0.05;
		this.direction_based.lerp(forward.multiplyScalar(currentSpeed), realignStrength);
		// end lerp
		if (isReasonablyOnGround) {
			const localVel = this.velocity.clone().applyQuaternion(this.aircraft.quaternion.clone().invert());
			const forwardVel = localVel.y;
			const lateralVel = localVel.x;
			let rollingCoeff = 0.002;
			if (braking) {
				rollingCoeff = 0.02;
			}
			const lateralCoeff = 0.7;
			const normalForce = this.mass * Math.abs(this.gravityAccel);
			const forwardFriction = -forwardVel * rollingCoeff * normalForce;
			const lateralFriction = -lateralVel * lateralCoeff * normalForce;
			const localFrictionForce = new THREE.Vector3(lateralFriction, forwardFriction, 0);
			const worldFriction = localFrictionForce.applyQuaternion(this.aircraft.quaternion);
			const frictionAccel = worldFriction.divideScalar(this.mass);
			this.direction_based.add(frictionAccel.multiplyScalar(dt));
		}
		const verticalForce = new THREE.Vector3()
			.add(lift)
			.add(gravity);
		const verticalAccel = verticalForce.clone().divideScalar(this.mass);
		if (!this.uniform_z) this.uniform_z = new THREE.Vector3();
		this.uniform_z.add(verticalAccel.multiplyScalar(dt));
		this.uniform_z.setX(0).setY(0);
		if (isOnGround && this.uniform_z.z < 0) {
			this.uniform_z.z = 0;
		}
		const smoothed = this.velocity.clone().lerp(this.direction_based.clone().add(this.uniform_z), 0.2);
		this.velocity.copy(smoothed);
		if (isOnGround && this.velocity.z < 0) {
			this.velocity.z = 0; // Stop downward motion
		}
		if (!this.suspension) this.suspension = new THREE.Vector3();
		if (groundDistance !== null && groundDistance < this.rest_length) {
			const suspensionForce = this.applyLandingGearForce(groundDistance);
			const suspensionAccel = suspensionForce.clone().divideScalar(this.mass);
			this.suspension.add(suspensionAccel.multiplyScalar(dt));
		}
		this.aircraft.position.lerp(this.aircraft.position.clone().add(this.suspension.clone().multiplyScalar(dt)), 0.2);
		const damping = Math.exp(-6 * dt);
		this.suspension.multiplyScalar(damping);
		if (this.suspension.lengthSq() < 0.5) {
			this.suspension.set(0, 0, 0);
		}
		const prepos = this.aircraft.position.z;
		const newpos = this.aircraft.position.clone().add(this.velocity.clone().multiplyScalar(dt));
		const smoothedpos = this.aircraft.position.clone().lerp(newpos, 0.2);
		this.aircraft.position.copy(smoothedpos);
		if (isOnGround && this.aircraft.position.z < prepos) {
			this.aircraft.position.z = prepos;
		}
	}
}
