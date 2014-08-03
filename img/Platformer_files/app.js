utils = (function(){

	return {
		collided: function(){
			var looksLikeABox = arguments[0].width && arguments[0].height;
			if(looksLikeABox){
				return this.boxCollided.apply(this,arguments);
			}
		},

		getBounds: function(box){
			return {
				top: box.y - box.height/2,
				left: box.x - box.width/2,
				right: box.x + box.width/2,
				bottom: box.y + box.height/2			
			}
		},

		boxCollided: function(box1,box2){	
			var A = this.getBounds(box1);
			var B = this.getBounds(box2);

			return ! (
				(A.bottom < B.top) ||
				(A.top > B.bottom) ||
				(A.left > B.right) ||
				(A.right < B.left)
			)
		},

		unitVector: function(v){
			var len_v = Math.sqrt(v.x*v.x + v.y*v.y);
			return {
				x: v.x /len_v,
				y: v.y / len_v
			}
		},

		dotProduct: function(a,b){
			return a.x*b.x + a.y*b.y;
		},

		projection: function(a,b){
			var dp = this.dotProduct(a,b);
			return {
				x: ( dp / (b.x*b.x + b.y*b.y) ) * b.x,
				y: ( dp / (b.x*b.x + b.y*b.y) ) * b.y
			}
		}
	}
	
})();

_.mixin({
	/*
	Just like extend, but does not modify.
	Useful for merging components for API calls, without modifying the originals
	*/
	create: function() {
		var args = Array.prototype.slice.call(arguments);
		args.unshift({});
		return this.extend.apply(this,args);
	},

	/*
	Returns the 1 or -1 depending on the polarity of input.
	*/
	polarity: function(num){
		if(this.isNumber(num)){
			return num > 0 && 1 || -1;
		}
	},

});

Keys = new (function(){

	this.DOWN = {};
	that = this;

	window.onkeydown = function(e){
		that.DOWN[e.keyCode] = that.DOWN[e.keyCode] || 0;
	}

	window.onkeyup = function(e){
		delete that.DOWN[e.keyCode];
	}

})();

/*
	Entity Manager
*/

E = (function(){
	return {

		components: {},
		
		create: function(components){
			var uid = _.uniqueId();
			this[uid] = uid;
	
			_(components).each(function(component,componentName){
				this.add(uid,componentName,component);
			},this)

			return uid;
		},

		add: function(uid, componentName, component){
			this.components[componentName] = this.components[componentName] || {};

			this[componentName] = function(entity){
				if(entity){
					return this.components[componentName] && this.components[componentName][entity];
				} else {
					return this.components[componentName];
				}
			}

			if(!this.components[componentName][uid]){
				
				if(uid in this){
					this.components[componentName][uid] = component
				}
			}
		}
	}
})();


Systems = {

	BoundsRendering: function(){
		
		E.Bounds && E.BoundsRenderable && _(E.BoundsRenderable()).each(function(component,entity){
			var position = E.Position(entity);
			var bounds = E.Bounds(entity);
			if(position && bounds){
				con.save();
					con.translate(position.x-bounds.width/2,position.y-bounds.height/2);
					con.rect(0,0,bounds.width,bounds.height);
					con.stroke();
				con.restore();
			}
		});
	},

	CanvasSetup: function () {
		window.con = window.con || can.getContext('2d');
		can.width = can.width;
		con.translate(can.width/2,can.height/2);
		window.scale = window.scale || 1;
		con.scale(scale,scale);
	},

	Movement: function(){
		E.Movement && _(E.Movement()).each(function(movement,entity){
			var position = E.Position(entity);
			if(position){
				position.x += movement.vx;
				position.y += movement.vy;
			}
		});
	},

	Gravity: function(){
		var GRAVITY_PER_TICK = 0.1;
		var MAX_GRAVITY = 9.8;
		E.GravitySensitive && _(E.GravitySensitive()).each(function(gravitySensitive,entity){
			var movement = E.Movement(entity);
			var collided = E.Collided && E.Collided(entity);
			if(!collided && movement && movement.vy < MAX_GRAVITY){
				movement.vy += GRAVITY_PER_TICK;
			}
		});
	},

	Collision: function(){
		E.CollisionSensitive && _(E.CollisionSensitive()).each(function(collisionSensitive,e1){

			_(E.CollisionSensitive()).each(function(collisionSensitive2,e2){

				if(e1 != e2){
				
					var box = [
						_.create(E.Position(e1),E.Bounds(e1)),
						_.create(E.Position(e2),E.Bounds(e2))
					];
					
					var collided = utils.collided(box[0],box[1]);
				
					if(collided){
						E.add(e1, 'Collided', { against:e2 } );
					}
				}
			});
		});
	},

	Stop: function(){
		E.Collided && _(E.Collided()).each(function(collided,entity){

			var movement = E.Movement(entity);
			var position = E.Position(entity);
			
			if(movement && position){
				
				var box = [
					_.create(E.Position(entity),E.Bounds(entity),E.Movement(entity)),
					_.create(E.Position(collided.against),E.Bounds(collided.against),E.Movement(collided.against))
				];
				
				
				position.x -= movement.vx || 0;
				position.y -= movement.vy || 0;

				box[0].x -= box[0].vx || 0;
				if(!utils.collided(box[0],box[1])){
					movement.vx = 0;
				} else {
					box[0].x += box[0].vx || 0;
					box[0].y -= box[0].vy || 0;
					if( !utils.collided(box[0],box[1])){
						movement.vy = 0;
					} else {
						movement.vx = 0;
					}	
				}
			}
		});
	},

	Launch: function(entity,options){
		var movement = E.Movement(entity);

		if(movement){
			(options.vx) && (movement.vx += options.vx);
			(options.vy) && (movement.vy += options.vy);
		}
	},

	KeyboardActivation: function(){
		E.KeyboardActivated && _(E.KeyboardActivated()).each(function(kbActivated,entity){
			_(Keys.DOWN).each(function(count,keyCode){
				var info = kbActivated[keyCode];
				var okay = true;
				if(info){
					if(info.before && !info.before(entity,info.options)){
						return;
					}
					if(info.delay && count%info.delay != 0){
						okay = false;
					}
					if(info.once && count != 1){
						okay = false;
					}
					if(okay){
						Systems[info.system].call(null,entity,info.options);
						if(info.after){
							info.after(entity,info.options);
						}
					}
				}
			});
		});
	},

	KeyboardTicker: function(){
		_(Keys.DOWN).each(function(count,keyCode,list){
			list[keyCode]+=1
		})
	},

	Friction: function(){
		var ignore = [];
		if(E.FrictionSensitive && E.Friction && E.Collided){
			_(E.Collided()).each(function(collided,entity){
				var against = collided.against;
				var sensitive = E.FrictionSensitive(entity) || E.FrictionSensitive(against);
				var fricter = E.Friction(entity) || E.Friction(against);

				if(fricter && sensitive && !_(ignore).contains(sensitive)){
					var movement = E.Movement(entity) || E.Movement(against);
					fricter.x && (movement.vx *= fricter.x * sensitive.sensitivity);
					fricter.y && (movement.vy *= fricter.y * sensitive.sensitivity);
				}
				ignore.push(sensitive)
			});		
		}
	},

	ChooseFrame: function(){
		E.State && _(E.State()).each(function(state,entity){
			var frame = E.Frame && E.Frame(entity);
			var src = frame.frame.image.src;
			src = src.replace(/_([a-z])*/,'_'+state.state);
			
			if(frame.frame.image.src != src){
				var img = $('img[src="'+src+'"]')[0];
				console.log(src,'img[src="'+src+'"]')
				if(img){

					frame.frame.reset(img);
				}
				
			}


		});

		function getImageBySrc(src){
			var img;
			$('img').each(function(){
			  if(src.indexOf($(this)[0].src) > -1){
			  	img = $(this)[0]
			  }
			})
			return img;
		}
	},

	MaxSpeed: function(){
		E.MaxSpeed && _(E.MaxSpeed()).each(function(maxSpeed,entity){
			var movement = E.Movement(entity);
			if(movement){
				if(Math.abs(movement.vx) > (maxSpeed.vx)){
					movement.vx = maxSpeed.vx * _(movement.vx).polarity();
				}
				if(Math.abs(movement.vy) > (maxSpeed.vy)){
					movement.vy = maxSpeed.vy * _(movement.vy).polarity();
				}
			}
		});
	},

	/*Draw strips of color where the color is a function of y to help detect movement.  Like a test pattern*/
	Background: function(){
		E.CameraFocused && _(E.CameraFocused()).every(function(focus,entity){
			var position = E.Position(entity);
			con.fillRect(position.x,position.y,20,20);
		});
		
	},

	Camera: function(){
		E.CameraFocused && _(E.CameraFocused()).each(function(focused,entity){
			var pos = E.Position(entity);
			con.translate(-pos.x,-pos.y);
		})
	},

	IsJumping: function(){
		E.Movement && _(E.Movement()).each(function(movement,entity){
			if(movement.vy<0){
				E.State && (E.State(entity).state = 'jump')
			} else {
				E.State && (E.State(entity).state = 'idle')
			}
		});
	},

	RemoveAirborne: function(){
		E.Collided && E.Airborne && _(E.Collided()).each(function(components,entity){
			delete E.components.Airborne[entity];
		});
	},

	DrawFrames: function(){
		E.Frame && _(E.Frame()).each(function(component,entity){
			var position = E.Position(entity);
			if(position){
				con.save();
					con.translate(position.x,position.y);
					component.frame.playspeed(component.playspeed);
					component.frame.scale(component.scale);
					component.frame.next();
				con.restore();
			}
		});
	},

	CleanUp: function(){
		delete E.components.Collided;
		delete E.components.Launched;
		delete E.components.IsJumping;
	}
}


var flower = E.create({
	Position: { x:50 , y:75 },
	Frame: {scale: 2, playspeed: 1/10, frame: new Frame().reset(resource_flower) },
});

var player = E.create({
	Frame: {scale: 2, playspeed: 1/10, frame: new Frame().reset(resource_luis_idle) },
	State: {state:'idle'},
	Bounds: { width:20, height:30 },
	Position: { x:0 , y:0 },
	Movement: { vx: 0, vy: 0},
	MaxSpeed: { vx: 1},
	GravitySensitive: {},
	FrictionSensitive: { sensitivity: 1 },
	CollisionSensitive: {},
	KeyboardActivated: {
		38: {system: 'Launch', options: {vy: -4}, once: true, 
			before: function(entity,options){
				var airborne = E.Airborne && E.Airborne(entity);
				return !airborne;
			},
			after: function(entity,options){
				E.add(entity,'Airborne',{});
			}
		},
		37: {system: 'Launch', options: {vx: -0.4}, delay: 1},
		39: {system: 'Launch', options: {vx: 0.4}, delay: 1},	
	},
	CameraFocused: {},
});

var block = E.create({
	
	Position: { x:0, y: 100 },
	CollisionSensitive: {},
	Bounds: { width: 300, height: 1 },
	Friction: { x: 0.8 },
	BoundsRenderable: {}
});

var block = E.create({
	Position: { x:0, y: 100-40 },
	CollisionSensitive: {},
	Bounds: { width: 40, height: 40 },
	Friction: { x: 0.1 },
	BoundsRenderable: {}
});

var use = [
	'CanvasSetup', 
	'CleanUp',
	'KeyboardTicker', 
	'KeyboardActivation',
	'Movement',
	'IsJumping',
	'ChooseFrame',
	'Collision',
	'RemoveAirborne',
	'Gravity', 
	'Stop',
	'Friction', //Friction and MaxSpeed come after stop so the reversal of vx/y isn't affected
	'MaxSpeed',
	'Camera',
	//'Background',
	'DrawFrames',
	'BoundsRendering',
];
function loop(){
	_(use).each(function(systemName){
		Systems[systemName]();
	});
	requestAnimationFrame(loop);
}
requestAnimationFrame(loop);