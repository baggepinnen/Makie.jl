{{GLSL_VERSION}}
{{GLSL_EXTENSIONS}}

// Sets which shading procedures to use
// Options:
// NO_SHADING           - skip shading calculation, handled outside
// FAST_SHADING         - single point light (forward rendering)
// MULTI_LIGHT_SHADING  - simple shading with multiple lights (forward rendering)
{{shading}}


// Generic uniforms

// Material parameters
// alternatively keep them as uniforms and allow samplers for
// diffuse_map, normal_map, depth_map etc
// struct Material {
//     // learnopengl mirrors these 3 to light
//     // vec3 ambient; // material property or light property?
//     vec3 diffuse;
//     vec3 specular;
//     float shininess;
// };

uniform vec3 diffuse;
uniform vec3 specular;
uniform float shininess;


////////////////////////////////////////////////////////////////////////////////
//                                FAST_SHADING                                //
////////////////////////////////////////////////////////////////////////////////


#ifdef FAST_SHADING

// in vec3 o_light_directions[MAX_LIGHTS];
in vec3 o_camdir;
in vec3 o_lightdir;

uniform vec3 ambient;
uniform vec3 light_color;
uniform float backlight;

vec3 blinn_phong(vec3 normal, vec3 light_dir, vec3 color) {
    // diffuse coefficient (how directly does light hits the surface)
    float diff_coeff = max(dot(light_dir, normal), 0.0);

    // specular coefficient (does reflected light bounce into camera?)
    vec3 H = normalize(light_dir + o_camdir);
    float spec_coeff = pow(max(dot(-H, normal), 0.0), shininess);
    if (diff_coeff <= 0.0 || isnan(spec_coeff))
        spec_coeff = 0.0;

    return vec3(diffuse * diff_coeff * color + specular * spec_coeff);
}

vec3 illuminate(vec3 normal, vec3 base_color) {
    vec3 lightdir = normalize(o_lightdir);
    vec3 light1 = blinn_phong(normal,  lightdir, base_color.rgb);
    vec3 light2 = blinn_phong(normal, -lightdir, base_color.rgb);
    // TODO light color
    return ambient * base_color.rgb + light_color * (light1 + backlight * light2);
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
uniform int light_types[MAX_LIGHTS];
uniform vec3 light_colors[MAX_LIGHTS];
uniform float light_parameters[MAX_LIGHT_PARAMETERS];
uniform int lights_length;

// in vec3 o_light_directions[MAX_LIGHTS];
in vec3 o_camdir;
in vec3 o_view_pos;

vec3 blinn_phong(vec3 light_color, vec3 normal, vec3 light_dir, vec3 color) {
    // diffuse coefficient (how directly does light hits the surface)
    float diff_coeff = max(dot(-light_dir, normal), 0.0);

    // specular coefficient (does reflected light bounce into camera?)
    vec3 H = normalize(light_dir + o_camdir);
    float spec_coeff = pow(max(dot(-H, normal), 0.0), shininess);
    if (diff_coeff <= 0.0 || isnan(spec_coeff))
        spec_coeff = 0.0;

    return light_color * vec3(diffuse * diff_coeff * color + specular * spec_coeff);
}

vec3 calc_point_light(vec3 light_color, uint idx, vec3 normal, vec3 color) {
    // extract args
    vec3 position = vec3(light_parameters[idx], light_parameters[idx+1], light_parameters[idx+2]);
    vec2 param = vec2(light_parameters[idx+3], light_parameters[idx+4]);

    // calculate light direction and distance
    vec3 light_vec = o_view_pos - position;

    float dist = length(light_vec);
    vec3 light_dir = normalize(light_vec);

    // How weak has the light gotten due to distance
    // float attentuation = 1.0 / (1.0 + dist * dist * dist);
    float attentuation = 1.0 / (1.0 + param.x * dist + param.y * dist * dist);

    return attentuation * blinn_phong(light_color, normal, light_dir, color);
}

vec3 calc_directional_light(vec3 light_color, uint idx, vec3 normal, vec3 color) {
    // TODO: don't calculate view * light_direction for each pixel
    // vec3 light_dir = normalize((view * vec4(light_directions[idx], 1)).xyz);
    vec3 direction = vec3(light_parameters[idx], light_parameters[idx+1], light_parameters[idx+2]);
    return blinn_phong(light_color, normal, direction, color);
}

vec3 calc_spot_light(vec3 light_color, uint idx, vec3 normal, vec3 color) {
    // extract args
    vec3 position = vec3(light_parameters[idx], light_parameters[idx+1], light_parameters[idx+2]);
    vec3 light_dir = normalize(vec3(light_parameters[idx+3], light_parameters[idx+4], light_parameters[idx+5]));
    float inner_angle = light_parameters[idx+6]; // cos applied
    float outer_angle = light_parameters[idx+7]; // cos applied

    vec3 vertex_dir = normalize(o_view_pos - position);
    // float theta = dot(vertex_dir, light_dir);
    // float epsilon = inner_angle - outer_angle;
    // float intensity = clamp((theta - outer_angle) / epsilon, 0.0, 1.0);
    float intensity = smoothstep(outer_angle, inner_angle, dot(vertex_dir, light_dir));

    return intensity * blinn_phong(light_color, normal, vertex_dir, color);
}

vec3 illuminate(vec3 normal, vec3 base_color) {
    vec3 final_color = vec3(0);
    uint idx = 0;
    for (int i = 0; i < min(lights_length, MAX_LIGHTS); i++) {
        switch (light_types[i]) {
        case Ambient:
            final_color += light_colors[i] * base_color;
            break;
        case PointLight:
            final_color += calc_point_light(light_colors[i], idx, normal, base_color);
            idx += 5; // 3 position, 2 attenuation params
            break;
        case DirectionalLight:
            final_color += calc_directional_light(light_colors[i], idx, normal, base_color);
            idx += 3; // 3 direction
            break;
        case SpotLight:
            final_color += calc_spot_light(light_colors[i], idx, normal, base_color);
            idx += 8; // 3 position, 3 direction, 1 parameter
            break;
        default:
            return vec3(1,0,1); // debug magenta
        }
    }
    return final_color;
}

#endif