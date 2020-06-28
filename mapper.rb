require_relative 'mandelbrot_factory'

class Mapper

end

resolutions = Renderer::RESOLUTIONS[5]
# cusp = CuspFactory.new resolutions, export_location: 'renders/cusp', mapfile: 'renders/cusp/mapfile1.json'
# cusp.precisions = [24]
# cusp.run
#
# seahorse_tail = SeahorseTailFactory.new resolutions, export_location: 'renders/seahorse_tail', mapfile: 'renders/seahorse_tail/mapfile4.json'
# seahorse_tail.precisions = (8..21)
# seahorse_tail.run


res = []
# res << [100, 100]
# res << [300, 300]
# res << [600, 600]
# res << [1000, 1000]
# res << [1500, 1500]
# res << [2000, 2000]
# res << [2500, 2500]
# res << [3000, 3000]
# res << [3500, 3500]
# res << [4000, 4000]
# res << [4500, 4500]
res << [5200, 4800]
#
#
resolutions = res
zoomed_out = ZoomedOutFactory.new(resolutions, mapfile: 'renders/zoomed_out/mapfile.json', export_location: 'renders/zoomed_out')
zoomed_out.precisions = [10]
zoomed_out.iterations = 1000
zoomed_out.center = [-0.7, 0 ]
zoomed_out.run
