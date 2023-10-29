# This file was generated, do not modify it. # hide
using Makie.LaTeXStrings: @L_str # hide
__result = begin # hide
    using GLMakie
GLMakie.activate!() # hide


x, y = collect(-8:0.5:8), collect(-8:0.5:8)
z = [sinc(√(X^2 + Y^2) / π) for X ∈ x, Y ∈ y]

wireframe(x, y, z, axis=(type=Axis3,), color=:black)
end # hide
save(joinpath(@OUTPUT, "example_12121718683131721059.png"), __result; ) # hide

nothing # hide