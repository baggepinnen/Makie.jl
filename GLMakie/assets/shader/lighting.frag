{{GLSL_VERSION}}
{{GLSL_EXTENSIONS}}

// Sets which shading procedures to use
// Options:
// NO_SHADING           - skip shading calculation, handled outside
// FAST_SHADING         - single point light (forward rendering)
// MULTI_LIGHT_SHADING  - simple shading with multiple lights (forward rendering)
{{shading}}


// Shared uniforms, inputs and functions
#if defined FAST_SHADING || defined MULTI_LIGHT_SHADING

// Generic uniforms
uniform vec3 diffuse;
uniform vec3 specular;
uniform float shininess;

uniform float backlight;

in vec3 o_camdir;
in vec3 o_world_pos;

float smooth_zero_max(float x) {
    // This is a smoothed version of max(value, 0.0) where -1 <= value <= 1
    // This comes from:
    // c = 2 ^ -a                                # normalizes power w/o swaps
    // xswap = (1 / c / a)^(1 / (a - 1)) - 1     # xval with derivative 1
    // yswap = c * (xswap+1) ^ a                 # yval with derivative 1
    // ifelse.(xs .< yswap, c .* (xs .+ 1 .+ xswap .- yswap) .^ a, xs)
    // a = 16 constants: (harder edge)
    // const float c = 0.0000152587890625, xswap = 0.7411011265922482, yswap = 0.10881882041201549;
    // a = 8 constants: (softer edge)
    const float c = 0.00390625, xswap = 0.6406707120152759, yswap = 0.20508383900190955;
    if (x < yswap)
        return c * pow(x + 1.0 + xswap - yswap, 16);
    else
        return x;
}

vec3 blinn_phong(vec3 light_color, vec3 light_dir, vec3 camdir, vec3 normal, vec3 color) {
    // diffuse coefficient (how directly does light hits the surface)
    float diff_coeff = smooth_zero_max(dot(light_dir, -normal)) +
        backlight * smooth_zero_max(dot(light_dir, normal));

    // specular coefficient (does reflected light bounce into camera?)
    vec3 H = normalize(light_dir + camdir);
    float spec_coeff = pow(max(dot(H, -normal), 0.0), shininess) +
        backlight * pow(max(dot(H, normal), 0.0), shininess);
    if (diff_coeff <= 0.0 || isnan(spec_coeff))
        spec_coeff = 0.0;

    return light_color * vec3(diffuse * diff_coeff * color + specular * spec_coeff);
}

#else // glsl fails to compile if the shader is just empty

vec3 illuminate(vec3 normal, vec3 base_color);

#endif


////////////////////////////////////////////////////////////////////////////////
//                                FAST_SHADING                                //
////////////////////////////////////////////////////////////////////////////////


#ifdef FAST_SHADING

uniform vec3 ambient;
uniform vec3 light_color;
uniform vec3 light_direction;

vec3 illuminate(vec3 world_pos, vec3 camdir, vec3 normal, vec3 base_color) {
    vec3 shaded_color = blinn_phong(light_color, light_direction, camdir, normal, base_color);
    return ambient * base_color + shaded_color;
}

vec3 illuminate(vec3 normal, vec3 base_color) {
    return illuminate(o_world_pos, normalize(o_camdir), normal, base_color);
}

#endif


////////////////////////////////////////////////////////////////////////////////
//                            MULTI_LIGHT_SHADING                             //
////////////////////////////////////////////////////////////////////////////////


#ifdef MULTI_LIGHT_SHADING

{{MAX_LIGHTS}}
{{MAX_LIGHT_PARAMETERS}}

// differentiating different light sources
const int UNDEFINED        = 0;
const int Ambient          = 1;
const int PointLight       = 2;
const int DirectionalLight = 3;
const int SpotLight        = 4;

// light parameters (maybe invalid depending on light type)
uniform int N_lights;
uniform int light_types[MAX_LIGHTS];
uniform vec3 light_colors[MAX_LIGHTS];
uniform float light_parameters[MAX_LIGHT_PARAMETERS];

vec3 calc_point_light(vec3 light_color, uint idx, vec3 world_pos, vec3 camdir, vec3 normal, vec3 color) {
    // extract args
    vec3 position = vec3(light_parameters[idx], light_parameters[idx+1], light_parameters[idx+2]);
    vec2 param = vec2(light_parameters[idx+3], light_parameters[idx+4]);

    // calculate light direction and distance
    vec3 light_vec = world_pos - position;

    float dist = length(light_vec);
    vec3 light_dir = normalize(light_vec);

    // How weak has the light gotten due to distance
    // float attentuation = 1.0 / (1.0 + dist * dist * dist);
    float attentuation = 1.0 / (1.0 + param.x * dist + param.y * dist * dist);

    return attentuation * blinn_phong(light_color, light_dir, camdir, normal, color);
}

vec3 calc_directional_light(vec3 light_color, uint idx, vec3 camdir, vec3 normal, vec3 color) {
    vec3 light_dir = vec3(light_parameters[idx], light_parameters[idx+1], light_parameters[idx+2]);
    return blinn_phong(light_color, light_dir, camdir, normal, color);
}

vec3 calc_spot_light(vec3 light_color, uint idx, vec3 world_pos, vec3 camdir, vec3 normal, vec3 color) {
    // extract args
    vec3 position = vec3(light_parameters[idx], light_parameters[idx+1], light_parameters[idx+2]);
    vec3 spot_light_dir = normalize(vec3(light_parameters[idx+3], light_parameters[idx+4], light_parameters[idx+5]));
    float inner_angle = light_parameters[idx+6]; // cos applied
    float outer_angle = light_parameters[idx+7]; // cos applied

    vec3 light_dir = normalize(world_pos - position);
    float intensity = smoothstep(outer_angle, inner_angle, dot(light_dir, spot_light_dir));

    return intensity * blinn_phong(light_color, light_dir, camdir, normal, color);
}

vec3 illuminate(vec3 world_pos, vec3 camdir, vec3 normal, vec3 base_color) {
    vec3 final_color = vec3(0);
    uint idx = 0;
    for (int i = 0; i < min(N_lights, MAX_LIGHTS); i++) {
        switch (light_types[i]) {
        case Ambient:
            final_color += light_colors[i] * base_color;
            break;
        case PointLight:
            final_color += calc_point_light(light_colors[i], idx, world_pos, camdir, normal, base_color);
            idx += 5; // 3 position, 2 attenuation params
            break;
        case DirectionalLight:
            final_color += calc_directional_light(light_colors[i], idx, camdir, normal, base_color);
            idx += 3; // 3 direction
            break;
        case SpotLight:
            final_color += calc_spot_light(light_colors[i], idx, world_pos, camdir, normal, base_color);
            idx += 8; // 3 position, 3 direction, 1 parameter
            break;
        default:
            return vec3(1,0,1); // debug magenta
        }
    }
    return final_color;
}

vec3 illuminate(vec3 normal, vec3 base_color) {
    return illuminate(o_world_pos, normalize(o_camdir), normal, base_color);
}

#endif