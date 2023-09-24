function to_opengl_mesh!(result, mesh_obs::TOrSignal{<: GeometryBasics.Mesh})
    m_attr = map(convert(Observable, mesh_obs)) do m
        return (m, GeometryBasics.attributes(m))
    end

    result[:faces] = indexbuffer(map(((m,_),)-> faces(m), m_attr))
    result[:vertices] = GLBuffer(map(((m, _),) -> metafree(coordinates(m)), m_attr))

    attribs = m_attr[][2]

    function to_buffer(name, target)
        if haskey(attribs, name)
            val = attribs[name]
            if mesh_obs isa Observable
                val = map(((m, a),)-> a[name], m_attr)
            end
            if val[] isa AbstractVector
                result[target] = GLBuffer(map(metafree, val))
            elseif val[] isa AbstractMatrix
                result[target] = Texture(val)
            else
                error("unsupported attribute: $(name)")
            end
        end
    end
    to_buffer(:color, :vertex_color)
    to_buffer(:uv, :texturecoordinates)
    to_buffer(:uvw, :texturecoordinates)
    # Only emit normals, when we shadin'
    shading = to_value(get(result, :shading, :none))
    matcap_active = !isnothing(to_value(get(result, :matcap, nothing)))
    if matcap_active || shading != :none
        to_buffer(:normals, :normals)
    end
    to_buffer(:attribute_id, :attribute_id)
    return result
end

function draw_mesh(screen, data::Dict)
    shading = to_value(pop!(data, :shading, :fast))
    @gen_defaults! data begin
        vertices = nothing => GLBuffer
        faces = nothing => indexbuffer
        normals = nothing => GLBuffer
        backlight = 0f0
        vertex_color = nothing => GLBuffer
        image = nothing => Texture
        matcap = nothing => Texture
        color_map = nothing => Texture
        color_norm = nothing
        fetch_pixel = false
        texturecoordinates = Vec2f(0) => GLBuffer
        uv_scale = Vec2f(1)
        transparency = false
        interpolate_in_fragment_shader = true
        shader = GLVisualizeShader(
            screen,
            "util.vert", "mesh.vert",
            "fragment_output.frag", "mesh.frag",
            "lighting.frag",
            view = Dict(
                "shading" => light_calc(shading),
                "buffers" => output_buffers(screen, to_value(transparency)),
                "buffer_writes" => output_buffer_writes(screen, to_value(transparency))
            )
        )
    end

    return assemble_shader(data)
end
