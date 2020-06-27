require_relative 'mandelbrot_factory'

class Mapper

end

resolutions = Renderer::RESOLUTIONS[13..14]
# cusp = CuspFactory.new resolutions, export_location: 'renders/cusp', mapfile: 'renders/cusp/mapfile1.json'
# cusp.precisions = [24]
# cusp.run
#
seahorse_tail = SeahorseTailFactory.new resolutions, export_location: 'renders/seahorse_tail', mapfile: 'renders/seahorse_tail/mapfile4.json'
seahorse_tail.precisions = (8..21)
seahorse_tail.run
