import { RigidBody } from "@react-three/rapier";
import { ShaderMaterial, Color } from "three";
import { folder, useControls } from 'leva'

export default function Floor() {

  //leva controls
	const debug = useControls('Floor Shader', {
		
		Sizes: folder({
			floorSize: {
				value: 2000,
				min: 1,
				max: 2000,
				step: 1,
			},
			minorGridSize: {
				value: 1000,
				min: 1,
				max: 4000,
				step: 2,
			},
			majorGridSize: {
				value: 100,
				min: 1,
				max: 1000,
				step: 2,
			},
		}),

		'Grid Thickness': folder({
			minorGridlineThickness: {
				value: 1.45,
				min: 0.5,
				max: 5,
				step: 0.001,
			},
			majorGridlineThickness: {
				value: 1,
				min: 0.5,
				max: 5,
				step: 0.001,
			},
			axisThickness: {
				value: 0.5,
				min: 0.1,
				max: 1,
				step: 0.001,
			},
		}),

		'Grid Colors': folder({
			minorGridColor: '#05bdb4',
			majorGridColor: '#0aa7b3ff',
			axisGridColor: '#ffffffff',
		}),

		'Light colors': folder({
			lightColor: '#e5e8e9',
		}),

	})

  const shaderMaterial = new ShaderMaterial({
    vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
    `,
		fragmentShader: 
    `
    //precision
    precision highp float;

    varying vec2 vUv;

    //uniforms
    uniform float u_minorGridlineThickness;
    uniform float u_majorGridlineThickness;
    uniform float u_axisThickness;
    uniform float u_minorGridSize;
    uniform float u_majorGridSize;
    uniform vec3 u_lightColor;
    uniform vec3 u_minorGridColor;
    uniform vec3 u_majorGridColor;
    uniform vec3 u_axisGridColor;

    float pristineGrid(vec2 uv, vec2 lineWidth) {
      //calculate derivatives for anti-aliasing
      vec2 ddx = dFdx(uv);
      vec2 ddy = dFdy(uv);
      vec2 uvDeriv = vec2(length(vec2(ddx.x, ddy.x)), length(vec2(ddx.y, ddy.y)));
      bvec2 invertLine = bvec2(lineWidth.x > 0.5, lineWidth.y > 0.5);
      vec2 targetWidth = vec2(
        invertLine.x
          ? 1.0 - lineWidth.x
          : lineWidth.x,
        invertLine.y
          ? 1.0 - lineWidth.y
          : lineWidth.y
      );
      vec2 drawWidth = clamp(targetWidth, uvDeriv, vec2(0.5));
      vec2 lineAA = uvDeriv * 1.5;
      vec2 gridUV = abs(fract(uv) * 2.0 - 1.0);

      gridUV.x = invertLine.x ? gridUV.x : 1.0 - gridUV.x;
      gridUV.y = invertLine.y ? gridUV.y : 1.0 - gridUV.y;
      vec2 grid2 = smoothstep(drawWidth + lineAA, drawWidth - lineAA, gridUV);

      grid2 *= clamp(targetWidth / drawWidth, 0.0, 1.0);
      grid2 = mix(grid2, targetWidth, clamp(uvDeriv * 2.0 - 1.0, 0.0, 1.0));
      grid2.x = invertLine.x ? 1.0 - grid2.x : grid2.x;
      grid2.y = invertLine.y ? 1.0 - grid2.y : grid2.y;

      return mix(grid2.x, 1.0, grid2.y);
    }

    void main() {
      vec2 coords = vUv;
      vec2 gradientCoords = coords - 0.5;
      vec2 minorGridCoords = coords;
      vec2 majorGridCoords = coords;

      vec2 axisCoords = coords;

      minorGridCoords *= u_minorGridSize;
      majorGridCoords *= u_majorGridSize;
      vec3 color;


      vec3 minorGridColor = u_minorGridColor;
      vec3 majorGridColor = u_majorGridColor;
      vec3 axisGridColor = u_axisGridColor;

    
      //light gradient
      vec3 lightColor = u_lightColor;

      float minorGrid = pristineGrid(minorGridCoords, vec2(u_minorGridlineThickness / 100.0));

      float majorGrid = pristineGrid(majorGridCoords, vec2(u_majorGridlineThickness / 100.0));

      float axisGrid = pristineGrid(axisCoords * 2.0, vec2(u_axisThickness / 1000.0));

      color = lightColor;

      color = mix(color, minorGridColor, minorGrid);

      color = mix(color, majorGridColor, majorGrid);

      color = mix(color, axisGridColor, axisGrid);

      gl_FragColor = vec4(color, 1.0);
    }
    `
    ,
		uniforms: {
			u_minorGridlineThickness: { value: debug.minorGridlineThickness },
			u_majorGridlineThickness: { value: debug.majorGridlineThickness },
			u_axisThickness: { value: debug.axisThickness },
			u_minorGridSize: { value: debug.minorGridSize },
			u_majorGridSize: { value: debug.majorGridSize },
			u_lightColor: { value: new Color(debug.lightColor) },
			u_minorGridColor: { value: new Color(debug.minorGridColor) },
			u_majorGridColor: { value: new Color(debug.majorGridColor) },
			u_axisGridColor: { value: new Color(debug.axisGridColor) },
		},
  })

  return (
    <RigidBody type="fixed">
      <mesh receiveShadow position={[0, -3.5, 0]} material={shaderMaterial}>
        <boxGeometry args={[300, 5, 300]} />
      </mesh>
    </RigidBody>
  );
}
