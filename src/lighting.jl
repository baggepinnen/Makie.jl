abstract type AbstractLight end

# GLMakie interface

# These need to match up with light shaders to differentiate light types
module LightType
    const UNDEFINED        = 0
    const Ambient          = 1
    const PointLight       = 2
    const DirectionalLight = 3
    const SpotLight        = 4
end

# always implement
light_type(::AbstractLight) = LightType.UNDEFINED

# implement as needed (keep types)
light_color(::AbstractLight) = RGBf(0, 0, 0)
light_position(::AbstractLight) = Vec3f(0)
light_direction(::AbstractLight) = Vec3f(0)
light_parameters(::AbstractLight) = Vec3f(0) # extra data passthrough



# TODO: Should we allow Palette for Light color initialization?

# TODO: probably need some kind of resize tracking?
# struct LightVector
#     lights::Vector{AbstractLight}
#     array_changed::Observable{Nothing}
# end

# for f in (push!, append!, setindex!, ...)
#     @eval function Base.($f)(lv::LightVector, args...; kwargs...)
#         output = ($f)(lv.lights, args...; kwargs...)
#         notify(lv.array_changed)
#         return output
#     end
# end


"""
    AmbientLight(color) <: AbstractLight

A simple ambient light that uniformly lights every object based on its light color.
"""
struct AmbientLight <: AbstractLight
    color::Observable{RGBf}
end

light_type(::AmbientLight) = LightType.Ambient
light_color(l::AmbientLight) = l.color[]


"""
    PointLight(color, position)

A point-like light source placed at the given `position` with the given light
`color`.
"""
struct PointLight <: AbstractLight
    color::Observable{RGBf}
    position::Observable{Vec3f}
end

light_type(::PointLight) = LightType.PointLight
light_color(l::PointLight) = l.color[]
light_position(l::PointLight) = l.position[]


"""
    DirectionalLight(color, direction)

A light type which simulates a distant light source with parallel light rays
going in the given `direction`.
"""
struct DirectionalLight <: AbstractLight
    color::Observable{RGBf}
    direction::Observable{Vec3f}
end

light_type(::DirectionalLight) = LightType.DirectionalLight
light_color(l::DirectionalLight) = l.color[]
light_direction(l::DirectionalLight) = l.direction[]


"""
    EnvironmentLight(intensity, image)

An environment Light, that uses a spherical environment map to provide lighting.
See: https://en.wikipedia.org/wiki/Reflection_mapping
"""
struct EnvironmentLight <: AbstractLight
    intensity::Observable{Float32}
    image::Observable{Matrix{RGBf}}
end


function get_one_light(lights, Typ)
    indices = findall(x-> x isa Typ, lights)
    isempty(indices) && return nothing
    return lights[indices[1]]
end