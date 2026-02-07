REGISTER-DOMAIN()                                            REGISTER-DOMAIN()



NNAAMMEE
       register-domain -

DDEESSCCRRIIPPTTIIOONN
       This  operation  registers a domain. For some top-level domains (TLDs),
       this operation requires extra parameters.

       When you register a domain, Amazon Route 53 does the following:

       +o Creates a Route 53 hosted zone that has the same name as the  domain.
         Route  53 assigns four name servers to your hosted zone and automati-
         cally updates your domain registration with the names of  these  name
         servers.

       +o Enables  auto renew, so your domain registration will renew automati-
         cally each year. We'll notify you in advance of the renewal  date  so
         you can choose whether to renew the registration.

       +o Optionally  enables  privacy protection, so WHOIS queries return con-
         tact for the registrar or the phrase "REDACTED FOR PRIVACY",  or  "On
         behalf  of  <domain name> owner." If you don't enable privacy protec-
         tion, WHOIS queries return the information that you entered  for  the
         administrative, registrant, and technical contacts.

       NNOOTTEE::
          While some domains may allow different privacy settings per contact,
          we recommend specifying the same privacy setting for all contacts.

       +o If registration is successful, returns an operation ID that  you  can
         use  to  track  the progress and completion of the action. If the re-
         quest is not completed successfully, the domain registrant  is  noti-
         fied by email.

       +o Charges  your  Amazon  Web  Services  account  an amount based on the
         top-level domain. For more information, see _A_m_a_z_o_n _R_o_u_t_e _5_3 _P_r_i_c_i_n_g .

       See also: AWS API Documentation

SSYYNNOOPPSSIISS
            register-domain
          --domain-name <value>
          [--idn-lang-code <value>]
          --duration-in-years <value>
          [--auto-renew | --no-auto-renew]
          --admin-contact <value>
          --registrant-contact <value>
          --tech-contact <value>
          [--privacy-protect-admin-contact | --no-privacy-protect-admin-contact]
          [--privacy-protect-registrant-contact | --no-privacy-protect-registrant-contact]
          [--privacy-protect-tech-contact | --no-privacy-protect-tech-contact]
          [--billing-contact <value>]
          [--privacy-protect-billing-contact | --no-privacy-protect-billing-contact]
          [--cli-input-json <value>]
          [--generate-cli-skeleton <value>]
          [--debug]
          [--endpoint-url <value>]
          [--no-verify-ssl]
          [--no-paginate]
          [--output <value>]
          [--query <value>]
          [--profile <value>]
          [--region <value>]
          [--version <value>]
          [--color <value>]
          [--no-sign-request]
          [--ca-bundle <value>]
          [--cli-read-timeout <value>]
          [--cli-connect-timeout <value>]

OOPPTTIIOONNSS
       ----ddoommaaiinn--nnaammee (string)
          The domain name that you want  to  register.  The  top-level  domain
          (TLD),  such  as  .com,  must be a TLD that Route 53 supports. For a
          list of supported TLDs, see _D_o_m_a_i_n_s _t_h_a_t _Y_o_u _C_a_n _R_e_g_i_s_t_e_r _w_i_t_h  _A_m_a_-
          _z_o_n _R_o_u_t_e _5_3 in the _A_m_a_z_o_n _R_o_u_t_e _5_3 _D_e_v_e_l_o_p_e_r _G_u_i_d_e .

          The domain name can contain only the following characters:

          +o Letters a through z. Domain names are not case sensitive.

          +o Numbers 0 through 9.

          +o Hyphen  (-). You can't specify a hyphen at the beginning or end of
            a label.

          +o Period (.) to separate the labels in the name, such as  the  ..  in
            eexxaammppllee..ccoomm .

          Internationalized  domain names are not supported for some top-level
          domains. To determine whether the TLD that you want to use  supports
          internationalized  domain  names,  see _D_o_m_a_i_n_s _t_h_a_t _Y_o_u _C_a_n _R_e_g_i_s_t_e_r
          _w_i_t_h _A_m_a_z_o_n _R_o_u_t_e _5_3 . For more information, see _F_o_r_m_a_t_t_i_n_g _I_n_t_e_r_n_a_-
          _t_i_o_n_a_l_i_z_e_d _D_o_m_a_i_n _N_a_m_e_s .

       ----iiddnn--llaanngg--ccooddee (string)
          Reserved for future use.

       ----dduurraattiioonn--iinn--yyeeaarrss (integer)
          The  number  of  years that you want to register the domain for. Do-
          mains are registered for a minimum of one year. The  maximum  period
          depends  on  the top-level domain. For the range of valid values for
          your domain, see _D_o_m_a_i_n_s _t_h_a_t _Y_o_u _C_a_n _R_e_g_i_s_t_e_r _w_i_t_h _A_m_a_z_o_n _R_o_u_t_e  _5_3
          in the _A_m_a_z_o_n _R_o_u_t_e _5_3 _D_e_v_e_l_o_p_e_r _G_u_i_d_e .

          Default: 1

       ----aauuttoo--rreenneeww | ----nnoo--aauuttoo--rreenneeww (boolean)
          Indicates  whether  the domain will be automatically renewed (ttrruuee )
          or not (ffaallssee ). Auto renewal only takes effect after the account is
          charged.

          Default: ttrruuee

       ----aaddmmiinn--ccoonnttaacctt (structure)
          Provides  detailed  contact  information.  For information about the
          values that you specify for each element, see _C_o_n_t_a_c_t_D_e_t_a_i_l .

          FirstName -> (string)
              First name of contact.

          LastName -> (string)
              Last name of contact.

          ContactType -> (string)
              Indicates whether the contact is a person, company, association,
              or public organization. Note the following:

              +o If you specify a value other than PPEERRSSOONN , you must also spec-
                ify a value for OOrrggaanniizzaattiioonnNNaammee .

              +o For some TLDs, the privacy protection available depends on the
                value that you specify for CCoonnttaacctt TTyyppee . For the privacy pro-
                tection settings for your TLD, see _D_o_m_a_i_n_s _t_h_a_t _Y_o_u _C_a_n _R_e_g_i_s_-
                _t_e_r  _w_i_t_h  _A_m_a_z_o_n  _R_o_u_t_e  _5_3  in the _A_m_a_z_o_n _R_o_u_t_e _5_3 _D_e_v_e_l_o_p_e_r
                _G_u_i_d_e

              +o For .es domains, the value of CCoonnttaaccttTTyyppee must be  PPEERRSSOONN  for
                all three contacts.

          OrganizationName -> (string)
              Name of the organization for contact types other than PPEERRSSOONN .

          AddressLine1 -> (string)
              First line of the contact's address.

          AddressLine2 -> (string)
              Second line of contact's address, if any.

          City -> (string)
              The city of the contact's address.

          State -> (string)
              The state or province of the contact's city.

          CountryCode -> (string)
              Code for the country of the contact's address.

          ZipCode -> (string)
              The zip or postal code of the contact's address.

          PhoneNumber -> (string)
              The phone number of the contact.

              Constraints:  Phone  number  must  be  specified  in  the format
              "+[country dialing code].[number including any area code>]". For
              example, a US phone number might appear as ""++11..11223344556677889900"" .

          Email -> (string)
              Email address of the contact.

          Fax -> (string)
              Fax number of the contact.

              Constraints:  Phone  number  must  be  specified  in  the format
              "+[country dialing code].[number including any area code]".  For
              example, a US phone number might appear as ""++11..11223344556677889900"" .

          ExtraParams -> (list)
              A  list  of  name-value pairs for parameters required by certain
              top-level domains.

              (structure)
                 ExtraParam includes the following elements.

                 Name -> (string)
                     The name of an additional parameter that is required by a
                     top-level domain. Here are the top-level domains that re-
                     quire additional parameters and the names of the  parame-
                     ters that they require:
                        .com.au and .net.au

                     +o AAUU__IIDD__NNUUMMBBEERR

                     +o AAUU__IIDD__TTYYPPEE   Valid values include the following:

                       +o AABBNN (Australian business number)

                       +o AACCNN (Australian company number)

                       +o TTMM (Trademark number)

                       .ca

                     +o BBRRAANNDD__NNUUMMBBEERR

                     +o CCAA__BBUUSSIINNEESSSS__EENNTTIITTYY__TTYYPPEE   Valid values include the fol-
                       lowing:

                       +o BBAANNKK (Bank)

                       +o CCOOMMMMEERRCCIIAALL__CCOOMMPPAANNYY (Commercial company)

                       +o CCOOMMPPAANNYY (Company)

                       +o CCOOOOPPEERRAATTIIOONN (Cooperation)

                       +o CCOOOOPPEERRAATTIIVVEE (Cooperative)

                       +o CCOOOOPPRRIIXX (Cooprix)

                       +o CCOORRPP (Corporation)

                       +o CCRREEDDIITT__UUNNIIOONN (Credit union)

                       +o FFOOMMIIAA (Federation of mutual insurance associations)

                       +o IINNCC (Incorporated)

                       +o LLTTDD (Limited)

                       +o LLTTEEEE (Limite)

                       +o LLLLCC (Limited liability corporation)

                       +o LLLLPP (Limited liability partnership)

                       +o LLTTEE (Lte.)

                       +o MMBBAA (Mutual benefit association)

                       +o MMIICC (Mutual insurance company)

                       +o NNFFPP (Not-for-profit corporation)

                       +o SSAA (S.A.)

                       +o SSAAVVIINNGGSS__CCOOMMPPAANNYY (Savings company)

                       +o SSAAVVIINNGGSS__UUNNIIOONN (Savings union)

                       +o SSAARRLL (Socit   responsabilit limite)

                       +o TTRRUUSSTT (Trust)

                       +o UULLCC (Unlimited liability corporation)

                     +o CCAA__LLEEGGAALL__TTYYPPEE   When CCoonnttaaccttTTyyppee is PPEERRSSOONN , valid val-
                       ues include the following:

                       +o AABBOO (Aboriginal Peoples indigenous to Canada)

                       +o CCCCTT (Canadian citizen)

                       +o LLGGRR  (Legal  Representative  of a Canadian Citizen or
                         Permanent Resident)

                       +o RREESS (Permanent resident of Canada)

                     When CCoonnttaaccttTTyyppee is a value other  than  PPEERRSSOONN  ,  valid
                     values include the following:

                        +o AASSSS (Canadian unincorporated association)

                        +o CCCCOO (Canadian corporation)

                        +o EEDDUU (Canadian educational institution)

                        +o GGOOVV (Government or government entity in Canada)

                        +o HHOOPP (Canadian Hospital)

                        +o IINNBB  (Indian  Band  recognized  by the Indian Act of
                          Canada)

                        +o LLAAMM (Canadian Library, Archive, or Museum)

                        +o MMAAJJ (Her/His Majesty the Queen/King)

                        +o OOMMKK (Official mark registered in Canada)

                        +o PPLLTT (Canadian Political Party)

                        +o PPRRTT (Partnership Registered in Canada)

                        +o TTDDMM (Trademark registered in Canada)

                        +o TTRRDD (Canadian Trade Union)

                        +o TTRRSS (Trust established in Canada)

                        .es

                     +o EESS__IIDDEENNTTIIFFIICCAATTIIOONN   The value of EESS__IIDDEENNTTIIFFIICCAATTIIOONN  de-
                       pends on the following values:

                       +o The value of EESS__LLEEGGAALL__FFOORRMM

                       +o The value of EESS__IIDDEENNTTIIFFIICCAATTIIOONN__TTYYPPEE
                        IIff  ````EESS__LLEEGGAALL__FFOORRMM````  iiss aannyy vvaalluuee ootthheerr tthhaann ````IINNDDII--
                        VVIIDDUUAALL```` ::

                            +o Specify 1 letter + 8 numbers  (CIF  [Certificado
                              de Identificacin Fiscal])

                            +o Example: B12345678

                        IIff  ````EESS__LLEEGGAALL__FFOORRMM````  iiss  ````IINNDDIIVVIIDDUUAALL````  ,, tthhee vvaalluuee
                        tthhaatt yyoouu ssppeecciiffyy ffoorr ````EESS__IIDDEENNTTIIFFIICCAATTIIOONN```` ddeeppeennddss  oonn
                        tthhee vvaalluuee ooff ````EESS__IIDDEENNTTIIFFIICCAATTIIOONN__TTYYPPEE```` ::

                            +o If  EESS__IIDDEENNTTIIFFIICCAATTIIOONN__TTYYPPEE  is  DDNNII__AANNDD__NNIIFF (for
                              Spanish contacts):

                              +o Specify 8 numbers + 1 letter  (DNI  [Documento
                                Nacional  de Identidad], NIF [Nmero de Identi-
                                ficacin Fiscal])

                              +o Example: 12345678M

                            +o If EESS__IIDDEENNTTIIFFIICCAATTIIOONN__TTYYPPEE is NNIIEE (for foreigners
                              with legal residence):

                              +o Specify  1 letter + 7 numbers + 1 letter ( NIE
                                [Nmero de Identidad de Extranjero])

                              +o Example: Y1234567X

                            +o If EESS__IIDDEENNTTIIFFIICCAATTIIOONN__TTYYPPEE is OOTTHHEERR (for contacts
                              outside of Spain):

                              +o Specify  a  passport  number,  drivers license
                                number, or national identity card number

                     +o EESS__IIDDEENNTTIIFFIICCAATTIIOONN__TTYYPPEE   Valid values include the  fol-
                       lowing:

                       +o DDNNII__AANNDD__NNIIFF (For Spanish contacts)

                       +o NNIIEE (For foreigners with legal residence)

                       +o OOTTHHEERR (For contacts outside of Spain)

                     +o EESS__LLEEGGAALL__FFOORRMM   Valid values include the following:

                       +o AASSSSOOCCIIAATTIIOONN

                       +o CCEENNTTRRAALL__GGOOVVEERRNNMMEENNTT__BBOODDYY

                       +o CCIIVVIILL__SSOOCCIIEETTYY

                       +o CCOOMMMMUUNNIITTYY__OOFF__OOWWNNEERRSS

                       +o CCOOMMMMUUNNIITTYY__PPRROOPPEERRTTYY

                       +o CCOONNSSUULLAATTEE

                       +o CCOOOOPPEERRAATTIIVVEE

                       +o DDEESSIIGGNNAATTIIOONN__OOFF__OORRIIGGIINN__SSUUPPEERRVVIISSOORRYY__CCOOUUNNCCIILL

                       +o EECCOONNOOMMIICC__IINNTTEERREESSTT__GGRROOUUPP

                       +o EEMMBBAASSSSYY

                       +o EENNTTIITTYY__MMAANNAAGGIINNGG__NNAATTUURRAALL__AARREEAASS

                       +o FFAARRMM__PPAARRTTNNEERRSSHHIIPP

                       +o FFOOUUNNDDAATTIIOONN

                       +o GGEENNEERRAALL__AANNDD__LLIIMMIITTEEDD__PPAARRTTNNEERRSSHHIIPP

                       +o GGEENNEERRAALL__PPAARRTTNNEERRSSHHIIPP

                       +o IINNDDIIVVIIDDUUAALL

                       +o LLIIMMIITTEEDD__CCOOMMPPAANNYY

                       +o LLOOCCAALL__AAUUTTHHOORRIITTYY

                       +o LLOOCCAALL__PPUUBBLLIICC__EENNTTIITTYY

                       +o MMUUTTUUAALL__IINNSSUURRAANNCCEE__CCOOMMPPAANNYY

                       +o NNAATTIIOONNAALL__PPUUBBLLIICC__EENNTTIITTYY

                       +o OORRDDEERR__OORR__RREELLIIGGIIOOUUSS__IINNSSTTIITTUUTTIIOONN

                       +o OOTTHHEERRSS ((OOnnllyy ffoorr ccoonnttaaccttss oouuttssiiddee ooff SSppaaiinn))

                       +o PPOOLLIITTIICCAALL__PPAARRTTYY

                       +o PPRROOFFEESSSSIIOONNAALL__AASSSSOOCCIIAATTIIOONN

                       +o PPUUBBLLIICC__LLAAWW__AASSSSOOCCIIAATTIIOONN

                       +o PPUUBBLLIICC__LLIIMMIITTEEDD__CCOOMMPPAANNYY

                       +o RREEGGIIOONNAALL__GGOOVVEERRNNMMEENNTT__BBOODDYY

                       +o RREEGGIIOONNAALL__PPUUBBLLIICC__EENNTTIITTYY

                       +o SSAAVVIINNGGSS__BBAANNKK

                       +o SSPPAANNIISSHH__OOFFFFIICCEE

                       +o SSPPOORRTTSS__AASSSSOOCCIIAATTIIOONN

                       +o SSPPOORRTTSS__FFEEDDEERRAATTIIOONN

                       +o SSPPOORRTTSS__LLIIMMIITTEEDD__CCOOMMPPAANNYY

                       +o TTEEMMPPOORRAARRYY__AALLLLIIAANNCCEE__OOFF__EENNTTEERRPPRRIISSEESS

                       +o TTRRAADDEE__UUNNIIOONN

                       +o WWOORRKKEERR__OOWWNNEEDD__CCOOMMPPAANNYY

                       +o WWOORRKKEERR__OOWWNNEEDD__LLIIMMIITTEEDD__CCOOMMPPAANNYY

                       .eu

                     +o EEUU__CCOOUUNNTTRRYY__OOFF__CCIITTIIZZEENNSSHHIIPP

                       .fi

                     +o BBIIRRTTHH__DDAATTEE__IINN__YYYYYYYY__MMMM__DDDD

                     +o FFII__BBUUSSIINNEESSSS__NNUUMMBBEERR

                     +o FFII__IIDD__NNUUMMBBEERR

                     +o FFII__NNAATTIIOONNAALLIITTYY   Valid values include the following:

                       +o FFIINNNNIISSHH

                       +o NNOOTT__FFIINNNNIISSHH

                     +o FFII__OORRGGAANNIIZZAATTIIOONN__TTYYPPEE   Valid values include the follow-
                       ing:

                       +o CCOOMMPPAANNYY

                       +o CCOORRPPOORRAATTIIOONN

                       +o GGOOVVEERRNNMMEENNTT

                       +o IINNSSTTIITTUUTTIIOONN

                       +o PPOOLLIITTIICCAALL__PPAARRTTYY

                       +o PPUUBBLLIICC__CCOOMMMMUUNNIITTYY

                       +o TTOOWWNNSSHHIIPP

                       .it

                     +o IITT__NNAATTIIOONNAALLIITTYY

                     +o IITT__PPIINN

                     +o IITT__RREEGGIISSTTRRAANNTT__EENNTTIITTYY__TTYYPPEE   Valid  values  include  the
                       following:

                       +o FFOORREEIIGGNNEERRSS

                       +o FFRREEEELLAANNCCEE__WWOORRKKEERRSS  (Freelance workers and profession-
                         als)

                       +o IITTAALLIIAANN__CCOOMMPPAANNIIEESS (Italian companies  and  one-person
                         companies)

                       +o NNOONN__PPRROOFFIITT__OORRGGAANNIIZZAATTIIOONNSS

                       +o OOTTHHEERR__SSUUBBJJEECCTTSS

                       +o PPUUBBLLIICC__OORRGGAANNIIZZAATTIIOONNSS

                       .ru

                     +o BBIIRRTTHH__DDAATTEE__IINN__YYYYYYYY__MMMM__DDDD

                     +o RRUU__PPAASSSSPPOORRTT__DDAATTAA

                       .se

                     +o BBIIRRTTHH__CCOOUUNNTTRRYY

                     +o SSEE__IIDD__NNUUMMBBEERR

                       .sg

                     +o SSGG__IIDD__NNUUMMBBEERR

                       .uk, .co.uk, .me.uk, and .org.uk

                     +o UUKK__CCOONNTTAACCTT__TTYYPPEE   Valid values include the following:

                       +o CCRRCC (UK Corporation by Royal Charter)

                       +o FFCCOORRPP (Non-UK Corporation)

                       +o FFIINNDD (Non-UK Individual, representing self)

                       +o FFOOTTHHEERR  (Non-UK  Entity  that  does  not fit into any
                         other category)

                       +o GGOOVV (UK Government Body)

                       +o IINNDD (UK Individual (representing self))

                       +o IIPP (UK Industrial/Provident Registered Company)

                       +o LLLLPP (UK Limited Liability Partnership)

                       +o LLTTDD (UK Limited Company)

                       +o OOTTHHEERR (UK Entity that does not  fit  into  any  other
                         category)

                       +o PPLLCC (UK Public Limited Company)

                       +o PPTTNNRR (UK Partnership)

                       +o RRCCHHAARR (UK Registered Charity)

                       +o SSCCHH (UK School)

                       +o SSTTAATT (UK Statutory Body)

                       +o SSTTRRAA (UK Sole Trader)

                     +o UUKK__CCOOMMPPAANNYY__NNUUMMBBEERR

                     In addition, many TLDs require a VVAATT__NNUUMMBBEERR .

                 Value -> (string)
                     The  value that corresponds with the name of an extra pa-
                     rameter.

       Shorthand Syntax:

          FirstName=string,LastName=string,ContactType=string,OrganizationName=string,AddressLine1=string,AddressLine2=string,City=string,State=string,CountryCode=string,ZipCode=string,PhoneNumber=string,Email=string,Fax=string,ExtraParams=[{Name=string,Value=string},{Name=string,Value=string}]

       JSON Syntax:

          {
            "FirstName": "string",
            "LastName": "string",
            "ContactType": "PERSON"|"COMPANY"|"ASSOCIATION"|"PUBLIC_BODY"|"RESELLER",
            "OrganizationName": "string",
            "AddressLine1": "string",
            "AddressLine2": "string",
            "City": "string",
            "State": "string",
            "CountryCode": "AC"|"AD"|"AE"|"AF"|"AG"|"AI"|"AL"|"AM"|"AN"|"AO"|"AQ"|"AR"|"AS"|"AT"|"AU"|"AW"|"AX"|"AZ"|"BA"|"BB"|"BD"|"BE"|"BF"|"BG"|"BH"|"BI"|"BJ"|"BL"|"BM"|"BN"|"BO"|"BQ"|"BR"|"BS"|"BT"|"BV"|"BW"|"BY"|"BZ"|"CA"|"CC"|"CD"|"CF"|"CG"|"CH"|"CI"|"CK"|"CL"|"CM"|"CN"|"CO"|"CR"|"CU"|"CV"|"CW"|"CX"|"CY"|"CZ"|"DE"|"DJ"|"DK"|"DM"|"DO"|"DZ"|"EC"|"EE"|"EG"|"EH"|"ER"|"ES"|"ET"|"FI"|"FJ"|"FK"|"FM"|"FO"|"FR"|"GA"|"GB"|"GD"|"GE"|"GF"|"GG"|"GH"|"GI"|"GL"|"GM"|"GN"|"GP"|"GQ"|"GR"|"GS"|"GT"|"GU"|"GW"|"GY"|"HK"|"HM"|"HN"|"HR"|"HT"|"HU"|"ID"|"IE"|"IL"|"IM"|"IN"|"IO"|"IQ"|"IR"|"IS"|"IT"|"JE"|"JM"|"JO"|"JP"|"KE"|"KG"|"KH"|"KI"|"KM"|"KN"|"KP"|"KR"|"KW"|"KY"|"KZ"|"LA"|"LB"|"LC"|"LI"|"LK"|"LR"|"LS"|"LT"|"LU"|"LV"|"LY"|"MA"|"MC"|"MD"|"ME"|"MF"|"MG"|"MH"|"MK"|"ML"|"MM"|"MN"|"MO"|"MP"|"MQ"|"MR"|"MS"|"MT"|"MU"|"MV"|"MW"|"MX"|"MY"|"MZ"|"NA"|"NC"|"NE"|"NF"|"NG"|"NI"|"NL"|"NO"|"NP"|"NR"|"NU"|"NZ"|"OM"|"PA"|"PE"|"PF"|"PG"|"PH"|"PK"|"PL"|"PM"|"PN"|"PR"|"PS"|"PT"|"PW"|"PY"|"QA"|"RE"|"RO"|"RS"|"RU"|"RW"|"SA"|"SB"|"SC"|"SD"|"SE"|"SG"|"SH"|"SI"|"SJ"|"SK"|"SL"|"SM"|"SN"|"SO"|"SR"|"SS"|"ST"|"SV"|"SX"|"SY"|"SZ"|"TC"|"TD"|"TF"|"TG"|"TH"|"TJ"|"TK"|"TL"|"TM"|"TN"|"TO"|"TP"|"TR"|"TT"|"TV"|"TW"|"TZ"|"UA"|"UG"|"US"|"UY"|"UZ"|"VA"|"VC"|"VE"|"VG"|"VI"|"VN"|"VU"|"WF"|"WS"|"YE"|"YT"|"ZA"|"ZM"|"ZW",
            "ZipCode": "string",
            "PhoneNumber": "string",
            "Email": "string",
            "Fax": "string",
            "ExtraParams": [
              {
                "Name": "DUNS_NUMBER"|"BRAND_NUMBER"|"BIRTH_DEPARTMENT"|"BIRTH_DATE_IN_YYYY_MM_DD"|"BIRTH_COUNTRY"|"BIRTH_CITY"|"DOCUMENT_NUMBER"|"AU_ID_NUMBER"|"AU_ID_TYPE"|"CA_LEGAL_TYPE"|"CA_BUSINESS_ENTITY_TYPE"|"CA_LEGAL_REPRESENTATIVE"|"CA_LEGAL_REPRESENTATIVE_CAPACITY"|"ES_IDENTIFICATION"|"ES_IDENTIFICATION_TYPE"|"ES_LEGAL_FORM"|"FI_BUSINESS_NUMBER"|"FI_ID_NUMBER"|"FI_NATIONALITY"|"FI_ORGANIZATION_TYPE"|"IT_NATIONALITY"|"IT_PIN"|"IT_REGISTRANT_ENTITY_TYPE"|"RU_PASSPORT_DATA"|"SE_ID_NUMBER"|"SG_ID_NUMBER"|"VAT_NUMBER"|"UK_CONTACT_TYPE"|"UK_COMPANY_NUMBER"|"EU_COUNTRY_OF_CITIZENSHIP"|"AU_PRIORITY_TOKEN",
                "Value": "string"
              }
              ...
            ]
          }

       ----rreeggiissttrraanntt--ccoonnttaacctt (structure)
          Provides detailed contact information.  For  information  about  the
          values that you specify for each element, see _C_o_n_t_a_c_t_D_e_t_a_i_l .

          FirstName -> (string)
              First name of contact.

          LastName -> (string)
              Last name of contact.

          ContactType -> (string)
              Indicates whether the contact is a person, company, association,
              or public organization. Note the following:

              +o If you specify a value other than PPEERRSSOONN , you must also spec-
                ify a value for OOrrggaanniizzaattiioonnNNaammee .

              +o For some TLDs, the privacy protection available depends on the
                value that you specify for CCoonnttaacctt TTyyppee . For the privacy pro-
                tection settings for your TLD, see _D_o_m_a_i_n_s _t_h_a_t _Y_o_u _C_a_n _R_e_g_i_s_-
                _t_e_r _w_i_t_h _A_m_a_z_o_n _R_o_u_t_e _5_3 in  the  _A_m_a_z_o_n  _R_o_u_t_e  _5_3  _D_e_v_e_l_o_p_e_r
                _G_u_i_d_e

              +o For  .es  domains, the value of CCoonnttaaccttTTyyppee must be PPEERRSSOONN for
                all three contacts.

          OrganizationName -> (string)
              Name of the organization for contact types other than PPEERRSSOONN .

          AddressLine1 -> (string)
              First line of the contact's address.

          AddressLine2 -> (string)
              Second line of contact's address, if any.

          City -> (string)
              The city of the contact's address.

          State -> (string)
              The state or province of the contact's city.

          CountryCode -> (string)
              Code for the country of the contact's address.

          ZipCode -> (string)
              The zip or postal code of the contact's address.

          PhoneNumber -> (string)
              The phone number of the contact.

              Constraints: Phone  number  must  be  specified  in  the  format
              "+[country dialing code].[number including any area code>]". For
              example, a US phone number might appear as ""++11..11223344556677889900"" .

          Email -> (string)
              Email address of the contact.

          Fax -> (string)
              Fax number of the contact.

              Constraints: Phone  number  must  be  specified  in  the  format
              "+[country  dialing code].[number including any area code]". For
              example, a US phone number might appear as ""++11..11223344556677889900"" .

          ExtraParams -> (list)
              A list of name-value pairs for parameters  required  by  certain
              top-level domains.

              (structure)
                 ExtraParam includes the following elements.

                 Name -> (string)
                     The name of an additional parameter that is required by a
                     top-level domain. Here are the top-level domains that re-
                     quire  additional parameters and the names of the parame-
                     ters that they require:
                        .com.au and .net.au

                     +o AAUU__IIDD__NNUUMMBBEERR

                     +o AAUU__IIDD__TTYYPPEE   Valid values include the following:

                       +o AABBNN (Australian business number)

                       +o AACCNN (Australian company number)

                       +o TTMM (Trademark number)

                       .ca

                     +o BBRRAANNDD__NNUUMMBBEERR

                     +o CCAA__BBUUSSIINNEESSSS__EENNTTIITTYY__TTYYPPEE   Valid values include the fol-
                       lowing:

                       +o BBAANNKK (Bank)

                       +o CCOOMMMMEERRCCIIAALL__CCOOMMPPAANNYY (Commercial company)

                       +o CCOOMMPPAANNYY (Company)

                       +o CCOOOOPPEERRAATTIIOONN (Cooperation)

                       +o CCOOOOPPEERRAATTIIVVEE (Cooperative)

                       +o CCOOOOPPRRIIXX (Cooprix)

                       +o CCOORRPP (Corporation)

                       +o CCRREEDDIITT__UUNNIIOONN (Credit union)

                       +o FFOOMMIIAA (Federation of mutual insurance associations)

                       +o IINNCC (Incorporated)

                       +o LLTTDD (Limited)

                       +o LLTTEEEE (Limite)

                       +o LLLLCC (Limited liability corporation)

                       +o LLLLPP (Limited liability partnership)

                       +o LLTTEE (Lte.)

                       +o MMBBAA (Mutual benefit association)

                       +o MMIICC (Mutual insurance company)

                       +o NNFFPP (Not-for-profit corporation)

                       +o SSAA (S.A.)

                       +o SSAAVVIINNGGSS__CCOOMMPPAANNYY (Savings company)

                       +o SSAAVVIINNGGSS__UUNNIIOONN (Savings union)

                       +o SSAARRLL (Socit   responsabilit limite)

                       +o TTRRUUSSTT (Trust)

                       +o UULLCC (Unlimited liability corporation)

                     +o CCAA__LLEEGGAALL__TTYYPPEE   When CCoonnttaaccttTTyyppee is PPEERRSSOONN , valid val-
                       ues include the following:

                       +o AABBOO (Aboriginal Peoples indigenous to Canada)

                       +o CCCCTT (Canadian citizen)

                       +o LLGGRR (Legal Representative of a  Canadian  Citizen  or
                         Permanent Resident)

                       +o RREESS (Permanent resident of Canada)

                     When  CCoonnttaaccttTTyyppee  is  a  value other than PPEERRSSOONN , valid
                     values include the following:

                        +o AASSSS (Canadian unincorporated association)

                        +o CCCCOO (Canadian corporation)

                        +o EEDDUU (Canadian educational institution)

                        +o GGOOVV (Government or government entity in Canada)

                        +o HHOOPP (Canadian Hospital)

                        +o IINNBB (Indian Band recognized by  the  Indian  Act  of
                          Canada)

                        +o LLAAMM (Canadian Library, Archive, or Museum)

                        +o MMAAJJ (Her/His Majesty the Queen/King)

                        +o OOMMKK (Official mark registered in Canada)

                        +o PPLLTT (Canadian Political Party)

                        +o PPRRTT (Partnership Registered in Canada)

                        +o TTDDMM (Trademark registered in Canada)

                        +o TTRRDD (Canadian Trade Union)

                        +o TTRRSS (Trust established in Canada)

                        .es

                     +o EESS__IIDDEENNTTIIFFIICCAATTIIOONN    The value of EESS__IIDDEENNTTIIFFIICCAATTIIOONN de-
                       pends on the following values:

                       +o The value of EESS__LLEEGGAALL__FFOORRMM

                       +o The value of EESS__IIDDEENNTTIIFFIICCAATTIIOONN__TTYYPPEE
                        IIff ````EESS__LLEEGGAALL__FFOORRMM```` iiss aannyy vvaalluuee ootthheerr  tthhaann  ````IINNDDII--
                        VVIIDDUUAALL```` ::

                            +o Specify  1  letter + 8 numbers (CIF [Certificado
                              de Identificacin Fiscal])

                            +o Example: B12345678

                        IIff ````EESS__LLEEGGAALL__FFOORRMM```` iiss  ````IINNDDIIVVIIDDUUAALL````  ,,  tthhee  vvaalluuee
                        tthhaatt  yyoouu ssppeecciiffyy ffoorr ````EESS__IIDDEENNTTIIFFIICCAATTIIOONN```` ddeeppeennddss oonn
                        tthhee vvaalluuee ooff ````EESS__IIDDEENNTTIIFFIICCAATTIIOONN__TTYYPPEE```` ::

                            +o If EESS__IIDDEENNTTIIFFIICCAATTIIOONN__TTYYPPEE  is  DDNNII__AANNDD__NNIIFF  (for
                              Spanish contacts):

                              +o Specify  8  numbers + 1 letter (DNI [Documento
                                Nacional de Identidad], NIF [Nmero de  Identi-
                                ficacin Fiscal])

                              +o Example: 12345678M

                            +o If EESS__IIDDEENNTTIIFFIICCAATTIIOONN__TTYYPPEE is NNIIEE (for foreigners
                              with legal residence):

                              +o Specify 1 letter + 7 numbers + 1 letter (  NIE
                                [Nmero de Identidad de Extranjero])

                              +o Example: Y1234567X

                            +o If EESS__IIDDEENNTTIIFFIICCAATTIIOONN__TTYYPPEE is OOTTHHEERR (for contacts
                              outside of Spain):

                              +o Specify a  passport  number,  drivers  license
                                number, or national identity card number

                     +o EESS__IIDDEENNTTIIFFIICCAATTIIOONN__TTYYPPEE    Valid values include the fol-
                       lowing:

                       +o DDNNII__AANNDD__NNIIFF (For Spanish contacts)

                       +o NNIIEE (For foreigners with legal residence)

                       +o OOTTHHEERR (For contacts outside of Spain)

                     +o EESS__LLEEGGAALL__FFOORRMM   Valid values include the following:

                       +o AASSSSOOCCIIAATTIIOONN

                       +o CCEENNTTRRAALL__GGOOVVEERRNNMMEENNTT__BBOODDYY

                       +o CCIIVVIILL__SSOOCCIIEETTYY

                       +o CCOOMMMMUUNNIITTYY__OOFF__OOWWNNEERRSS

                       +o CCOOMMMMUUNNIITTYY__PPRROOPPEERRTTYY

                       +o CCOONNSSUULLAATTEE

                       +o CCOOOOPPEERRAATTIIVVEE

                       +o DDEESSIIGGNNAATTIIOONN__OOFF__OORRIIGGIINN__SSUUPPEERRVVIISSOORRYY__CCOOUUNNCCIILL

                       +o EECCOONNOOMMIICC__IINNTTEERREESSTT__GGRROOUUPP

                       +o EEMMBBAASSSSYY

                       +o EENNTTIITTYY__MMAANNAAGGIINNGG__NNAATTUURRAALL__AARREEAASS

                       +o FFAARRMM__PPAARRTTNNEERRSSHHIIPP

                       +o FFOOUUNNDDAATTIIOONN

                       +o GGEENNEERRAALL__AANNDD__LLIIMMIITTEEDD__PPAARRTTNNEERRSSHHIIPP

                       +o GGEENNEERRAALL__PPAARRTTNNEERRSSHHIIPP

                       +o IINNDDIIVVIIDDUUAALL

                       +o LLIIMMIITTEEDD__CCOOMMPPAANNYY

                       +o LLOOCCAALL__AAUUTTHHOORRIITTYY

                       +o LLOOCCAALL__PPUUBBLLIICC__EENNTTIITTYY

                       +o MMUUTTUUAALL__IINNSSUURRAANNCCEE__CCOOMMPPAANNYY

                       +o NNAATTIIOONNAALL__PPUUBBLLIICC__EENNTTIITTYY

                       +o OORRDDEERR__OORR__RREELLIIGGIIOOUUSS__IINNSSTTIITTUUTTIIOONN

                       +o OOTTHHEERRSS ((OOnnllyy ffoorr ccoonnttaaccttss oouuttssiiddee ooff SSppaaiinn))

                       +o PPOOLLIITTIICCAALL__PPAARRTTYY

                       +o PPRROOFFEESSSSIIOONNAALL__AASSSSOOCCIIAATTIIOONN

                       +o PPUUBBLLIICC__LLAAWW__AASSSSOOCCIIAATTIIOONN

                       +o PPUUBBLLIICC__LLIIMMIITTEEDD__CCOOMMPPAANNYY

                       +o RREEGGIIOONNAALL__GGOOVVEERRNNMMEENNTT__BBOODDYY

                       +o RREEGGIIOONNAALL__PPUUBBLLIICC__EENNTTIITTYY

                       +o SSAAVVIINNGGSS__BBAANNKK

                       +o SSPPAANNIISSHH__OOFFFFIICCEE

                       +o SSPPOORRTTSS__AASSSSOOCCIIAATTIIOONN

                       +o SSPPOORRTTSS__FFEEDDEERRAATTIIOONN

                       +o SSPPOORRTTSS__LLIIMMIITTEEDD__CCOOMMPPAANNYY

                       +o TTEEMMPPOORRAARRYY__AALLLLIIAANNCCEE__OOFF__EENNTTEERRPPRRIISSEESS

                       +o TTRRAADDEE__UUNNIIOONN

                       +o WWOORRKKEERR__OOWWNNEEDD__CCOOMMPPAANNYY

                       +o WWOORRKKEERR__OOWWNNEEDD__LLIIMMIITTEEDD__CCOOMMPPAANNYY

                       .eu

                     +o EEUU__CCOOUUNNTTRRYY__OOFF__CCIITTIIZZEENNSSHHIIPP

                       .fi

                     +o BBIIRRTTHH__DDAATTEE__IINN__YYYYYYYY__MMMM__DDDD

                     +o FFII__BBUUSSIINNEESSSS__NNUUMMBBEERR

                     +o FFII__IIDD__NNUUMMBBEERR

                     +o FFII__NNAATTIIOONNAALLIITTYY   Valid values include the following:

                       +o FFIINNNNIISSHH

                       +o NNOOTT__FFIINNNNIISSHH

                     +o FFII__OORRGGAANNIIZZAATTIIOONN__TTYYPPEE   Valid values include the follow-
                       ing:

                       +o CCOOMMPPAANNYY

                       +o CCOORRPPOORRAATTIIOONN

                       +o GGOOVVEERRNNMMEENNTT

                       +o IINNSSTTIITTUUTTIIOONN

                       +o PPOOLLIITTIICCAALL__PPAARRTTYY

                       +o PPUUBBLLIICC__CCOOMMMMUUNNIITTYY

                       +o TTOOWWNNSSHHIIPP

                       .it

                     +o IITT__NNAATTIIOONNAALLIITTYY

                     +o IITT__PPIINN

                     +o IITT__RREEGGIISSTTRRAANNTT__EENNTTIITTYY__TTYYPPEE    Valid  values  include the
                       following:

                       +o FFOORREEIIGGNNEERRSS

                       +o FFRREEEELLAANNCCEE__WWOORRKKEERRSS (Freelance workers and  profession-
                         als)

                       +o IITTAALLIIAANN__CCOOMMPPAANNIIEESS  (Italian  companies and one-person
                         companies)

                       +o NNOONN__PPRROOFFIITT__OORRGGAANNIIZZAATTIIOONNSS

                       +o OOTTHHEERR__SSUUBBJJEECCTTSS

                       +o PPUUBBLLIICC__OORRGGAANNIIZZAATTIIOONNSS

                       .ru

                     +o BBIIRRTTHH__DDAATTEE__IINN__YYYYYYYY__MMMM__DDDD

                     +o RRUU__PPAASSSSPPOORRTT__DDAATTAA

                       .se

                     +o BBIIRRTTHH__CCOOUUNNTTRRYY

                     +o SSEE__IIDD__NNUUMMBBEERR

                       .sg

                     +o SSGG__IIDD__NNUUMMBBEERR

                       .uk, .co.uk, .me.uk, and .org.uk

                     +o UUKK__CCOONNTTAACCTT__TTYYPPEE   Valid values include the following:

                       +o CCRRCC (UK Corporation by Royal Charter)

                       +o FFCCOORRPP (Non-UK Corporation)

                       +o FFIINNDD (Non-UK Individual, representing self)

                       +o FFOOTTHHEERR (Non-UK Entity that  does  not  fit  into  any
                         other category)

                       +o GGOOVV (UK Government Body)

                       +o IINNDD (UK Individual (representing self))

                       +o IIPP (UK Industrial/Provident Registered Company)

                       +o LLLLPP (UK Limited Liability Partnership)

                       +o LLTTDD (UK Limited Company)

                       +o OOTTHHEERR  (UK  Entity  that  does not fit into any other
                         category)

                       +o PPLLCC (UK Public Limited Company)

                       +o PPTTNNRR (UK Partnership)

                       +o RRCCHHAARR (UK Registered Charity)

                       +o SSCCHH (UK School)

                       +o SSTTAATT (UK Statutory Body)

                       +o SSTTRRAA (UK Sole Trader)

                     +o UUKK__CCOOMMPPAANNYY__NNUUMMBBEERR

                     In addition, many TLDs require a VVAATT__NNUUMMBBEERR .

                 Value -> (string)
                     The value that corresponds with the name of an extra  pa-
                     rameter.

       Shorthand Syntax:

          FirstName=string,LastName=string,ContactType=string,OrganizationName=string,AddressLine1=string,AddressLine2=string,City=string,State=string,CountryCode=string,ZipCode=string,PhoneNumber=string,Email=string,Fax=string,ExtraParams=[{Name=string,Value=string},{Name=string,Value=string}]

       JSON Syntax:

          {
            "FirstName": "string",
            "LastName": "string",
            "ContactType": "PERSON"|"COMPANY"|"ASSOCIATION"|"PUBLIC_BODY"|"RESELLER",
            "OrganizationName": "string",
            "AddressLine1": "string",
            "AddressLine2": "string",
            "City": "string",
            "State": "string",
            "CountryCode": "AC"|"AD"|"AE"|"AF"|"AG"|"AI"|"AL"|"AM"|"AN"|"AO"|"AQ"|"AR"|"AS"|"AT"|"AU"|"AW"|"AX"|"AZ"|"BA"|"BB"|"BD"|"BE"|"BF"|"BG"|"BH"|"BI"|"BJ"|"BL"|"BM"|"BN"|"BO"|"BQ"|"BR"|"BS"|"BT"|"BV"|"BW"|"BY"|"BZ"|"CA"|"CC"|"CD"|"CF"|"CG"|"CH"|"CI"|"CK"|"CL"|"CM"|"CN"|"CO"|"CR"|"CU"|"CV"|"CW"|"CX"|"CY"|"CZ"|"DE"|"DJ"|"DK"|"DM"|"DO"|"DZ"|"EC"|"EE"|"EG"|"EH"|"ER"|"ES"|"ET"|"FI"|"FJ"|"FK"|"FM"|"FO"|"FR"|"GA"|"GB"|"GD"|"GE"|"GF"|"GG"|"GH"|"GI"|"GL"|"GM"|"GN"|"GP"|"GQ"|"GR"|"GS"|"GT"|"GU"|"GW"|"GY"|"HK"|"HM"|"HN"|"HR"|"HT"|"HU"|"ID"|"IE"|"IL"|"IM"|"IN"|"IO"|"IQ"|"IR"|"IS"|"IT"|"JE"|"JM"|"JO"|"JP"|"KE"|"KG"|"KH"|"KI"|"KM"|"KN"|"KP"|"KR"|"KW"|"KY"|"KZ"|"LA"|"LB"|"LC"|"LI"|"LK"|"LR"|"LS"|"LT"|"LU"|"LV"|"LY"|"MA"|"MC"|"MD"|"ME"|"MF"|"MG"|"MH"|"MK"|"ML"|"MM"|"MN"|"MO"|"MP"|"MQ"|"MR"|"MS"|"MT"|"MU"|"MV"|"MW"|"MX"|"MY"|"MZ"|"NA"|"NC"|"NE"|"NF"|"NG"|"NI"|"NL"|"NO"|"NP"|"NR"|"NU"|"NZ"|"OM"|"PA"|"PE"|"PF"|"PG"|"PH"|"PK"|"PL"|"PM"|"PN"|"PR"|"PS"|"PT"|"PW"|"PY"|"QA"|"RE"|"RO"|"RS"|"RU"|"RW"|"SA"|"SB"|"SC"|"SD"|"SE"|"SG"|"SH"|"SI"|"SJ"|"SK"|"SL"|"SM"|"SN"|"SO"|"SR"|"SS"|"ST"|"SV"|"SX"|"SY"|"SZ"|"TC"|"TD"|"TF"|"TG"|"TH"|"TJ"|"TK"|"TL"|"TM"|"TN"|"TO"|"TP"|"TR"|"TT"|"TV"|"TW"|"TZ"|"UA"|"UG"|"US"|"UY"|"UZ"|"VA"|"VC"|"VE"|"VG"|"VI"|"VN"|"VU"|"WF"|"WS"|"YE"|"YT"|"ZA"|"ZM"|"ZW",
            "ZipCode": "string",
            "PhoneNumber": "string",
            "Email": "string",
            "Fax": "string",
            "ExtraParams": [
              {
                "Name": "DUNS_NUMBER"|"BRAND_NUMBER"|"BIRTH_DEPARTMENT"|"BIRTH_DATE_IN_YYYY_MM_DD"|"BIRTH_COUNTRY"|"BIRTH_CITY"|"DOCUMENT_NUMBER"|"AU_ID_NUMBER"|"AU_ID_TYPE"|"CA_LEGAL_TYPE"|"CA_BUSINESS_ENTITY_TYPE"|"CA_LEGAL_REPRESENTATIVE"|"CA_LEGAL_REPRESENTATIVE_CAPACITY"|"ES_IDENTIFICATION"|"ES_IDENTIFICATION_TYPE"|"ES_LEGAL_FORM"|"FI_BUSINESS_NUMBER"|"FI_ID_NUMBER"|"FI_NATIONALITY"|"FI_ORGANIZATION_TYPE"|"IT_NATIONALITY"|"IT_PIN"|"IT_REGISTRANT_ENTITY_TYPE"|"RU_PASSPORT_DATA"|"SE_ID_NUMBER"|"SG_ID_NUMBER"|"VAT_NUMBER"|"UK_CONTACT_TYPE"|"UK_COMPANY_NUMBER"|"EU_COUNTRY_OF_CITIZENSHIP"|"AU_PRIORITY_TOKEN",
                "Value": "string"
              }
              ...
            ]
          }

       ----tteecchh--ccoonnttaacctt (structure)
          Provides  detailed  contact  information.  For information about the
          values that you specify for each element, see _C_o_n_t_a_c_t_D_e_t_a_i_l .

          FirstName -> (string)
              First name of contact.

          LastName -> (string)
              Last name of contact.

          ContactType -> (string)
              Indicates whether the contact is a person, company, association,
              or public organization. Note the following:

              +o If you specify a value other than PPEERRSSOONN , you must also spec-
                ify a value for OOrrggaanniizzaattiioonnNNaammee .

              +o For some TLDs, the privacy protection available depends on the
                value that you specify for CCoonnttaacctt TTyyppee . For the privacy pro-
                tection settings for your TLD, see _D_o_m_a_i_n_s _t_h_a_t _Y_o_u _C_a_n _R_e_g_i_s_-
                _t_e_r  _w_i_t_h  _A_m_a_z_o_n  _R_o_u_t_e  _5_3  in the _A_m_a_z_o_n _R_o_u_t_e _5_3 _D_e_v_e_l_o_p_e_r
                _G_u_i_d_e

              +o For .es domains, the value of CCoonnttaaccttTTyyppee must be  PPEERRSSOONN  for
                all three contacts.

          OrganizationName -> (string)
              Name of the organization for contact types other than PPEERRSSOONN .

          AddressLine1 -> (string)
              First line of the contact's address.

          AddressLine2 -> (string)
              Second line of contact's address, if any.

          City -> (string)
              The city of the contact's address.

          State -> (string)
              The state or province of the contact's city.

          CountryCode -> (string)
              Code for the country of the contact's address.

          ZipCode -> (string)
              The zip or postal code of the contact's address.

          PhoneNumber -> (string)
              The phone number of the contact.

              Constraints:  Phone  number  must  be  specified  in  the format
              "+[country dialing code].[number including any area code>]". For
              example, a US phone number might appear as ""++11..11223344556677889900"" .

          Email -> (string)
              Email address of the contact.

          Fax -> (string)
              Fax number of the contact.

              Constraints:  Phone  number  must  be  specified  in  the format
              "+[country dialing code].[number including any area code]".  For
              example, a US phone number might appear as ""++11..11223344556677889900"" .

          ExtraParams -> (list)
              A  list  of  name-value pairs for parameters required by certain
              top-level domains.

              (structure)
                 ExtraParam includes the following elements.

                 Name -> (string)
                     The name of an additional parameter that is required by a
                     top-level domain. Here are the top-level domains that re-
                     quire additional parameters and the names of the  parame-
                     ters that they require:
                        .com.au and .net.au

                     +o AAUU__IIDD__NNUUMMBBEERR

                     +o AAUU__IIDD__TTYYPPEE   Valid values include the following:

                       +o AABBNN (Australian business number)

                       +o AACCNN (Australian company number)

                       +o TTMM (Trademark number)

                       .ca

                     +o BBRRAANNDD__NNUUMMBBEERR

                     +o CCAA__BBUUSSIINNEESSSS__EENNTTIITTYY__TTYYPPEE   Valid values include the fol-
                       lowing:

                       +o BBAANNKK (Bank)

                       +o CCOOMMMMEERRCCIIAALL__CCOOMMPPAANNYY (Commercial company)

                       +o CCOOMMPPAANNYY (Company)

                       +o CCOOOOPPEERRAATTIIOONN (Cooperation)

                       +o CCOOOOPPEERRAATTIIVVEE (Cooperative)

                       +o CCOOOOPPRRIIXX (Cooprix)

                       +o CCOORRPP (Corporation)

                       +o CCRREEDDIITT__UUNNIIOONN (Credit union)

                       +o FFOOMMIIAA (Federation of mutual insurance associations)

                       +o IINNCC (Incorporated)

                       +o LLTTDD (Limited)

                       +o LLTTEEEE (Limite)

                       +o LLLLCC (Limited liability corporation)

                       +o LLLLPP (Limited liability partnership)

                       +o LLTTEE (Lte.)

                       +o MMBBAA (Mutual benefit association)

                       +o MMIICC (Mutual insurance company)

                       +o NNFFPP (Not-for-profit corporation)

                       +o SSAA (S.A.)

                       +o SSAAVVIINNGGSS__CCOOMMPPAANNYY (Savings company)

                       +o SSAAVVIINNGGSS__UUNNIIOONN (Savings union)

                       +o SSAARRLL (Socit   responsabilit limite)

                       +o TTRRUUSSTT (Trust)

                       +o UULLCC (Unlimited liability corporation)

                     +o CCAA__LLEEGGAALL__TTYYPPEE   When CCoonnttaaccttTTyyppee is PPEERRSSOONN , valid val-
                       ues include the following:

                       +o AABBOO (Aboriginal Peoples indigenous to Canada)

                       +o CCCCTT (Canadian citizen)

                       +o LLGGRR  (Legal  Representative  of a Canadian Citizen or
                         Permanent Resident)

                       +o RREESS (Permanent resident of Canada)

                     When CCoonnttaaccttTTyyppee is a value other  than  PPEERRSSOONN  ,  valid
                     values include the following:

                        +o AASSSS (Canadian unincorporated association)

                        +o CCCCOO (Canadian corporation)

                        +o EEDDUU (Canadian educational institution)

                        +o GGOOVV (Government or government entity in Canada)

                        +o HHOOPP (Canadian Hospital)

                        +o IINNBB  (Indian  Band  recognized  by the Indian Act of
                          Canada)

                        +o LLAAMM (Canadian Library, Archive, or Museum)

                        +o MMAAJJ (Her/His Majesty the Queen/King)

                        +o OOMMKK (Official mark registered in Canada)

                        +o PPLLTT (Canadian Political Party)

                        +o PPRRTT (Partnership Registered in Canada)

                        +o TTDDMM (Trademark registered in Canada)

                        +o TTRRDD (Canadian Trade Union)

                        +o TTRRSS (Trust established in Canada)

                        .es

                     +o EESS__IIDDEENNTTIIFFIICCAATTIIOONN   The value of EESS__IIDDEENNTTIIFFIICCAATTIIOONN  de-
                       pends on the following values:

                       +o The value of EESS__LLEEGGAALL__FFOORRMM

                       +o The value of EESS__IIDDEENNTTIIFFIICCAATTIIOONN__TTYYPPEE
                        IIff  ````EESS__LLEEGGAALL__FFOORRMM````  iiss aannyy vvaalluuee ootthheerr tthhaann ````IINNDDII--
                        VVIIDDUUAALL```` ::

                            +o Specify 1 letter + 8 numbers  (CIF  [Certificado
                              de Identificacin Fiscal])

                            +o Example: B12345678

                        IIff  ````EESS__LLEEGGAALL__FFOORRMM````  iiss  ````IINNDDIIVVIIDDUUAALL````  ,, tthhee vvaalluuee
                        tthhaatt yyoouu ssppeecciiffyy ffoorr ````EESS__IIDDEENNTTIIFFIICCAATTIIOONN```` ddeeppeennddss  oonn
                        tthhee vvaalluuee ooff ````EESS__IIDDEENNTTIIFFIICCAATTIIOONN__TTYYPPEE```` ::

                            +o If  EESS__IIDDEENNTTIIFFIICCAATTIIOONN__TTYYPPEE  is  DDNNII__AANNDD__NNIIFF (for
                              Spanish contacts):

                              +o Specify 8 numbers + 1 letter  (DNI  [Documento
                                Nacional  de Identidad], NIF [Nmero de Identi-
                                ficacin Fiscal])

                              +o Example: 12345678M

                            +o If EESS__IIDDEENNTTIIFFIICCAATTIIOONN__TTYYPPEE is NNIIEE (for foreigners
                              with legal residence):

                              +o Specify  1 letter + 7 numbers + 1 letter ( NIE
                                [Nmero de Identidad de Extranjero])

                              +o Example: Y1234567X

                            +o If EESS__IIDDEENNTTIIFFIICCAATTIIOONN__TTYYPPEE is OOTTHHEERR (for contacts
                              outside of Spain):

                              +o Specify  a  passport  number,  drivers license
                                number, or national identity card number

                     +o EESS__IIDDEENNTTIIFFIICCAATTIIOONN__TTYYPPEE   Valid values include the  fol-
                       lowing:

                       +o DDNNII__AANNDD__NNIIFF (For Spanish contacts)

                       +o NNIIEE (For foreigners with legal residence)

                       +o OOTTHHEERR (For contacts outside of Spain)

                     +o EESS__LLEEGGAALL__FFOORRMM   Valid values include the following:

                       +o AASSSSOOCCIIAATTIIOONN

                       +o CCEENNTTRRAALL__GGOOVVEERRNNMMEENNTT__BBOODDYY

                       +o CCIIVVIILL__SSOOCCIIEETTYY

                       +o CCOOMMMMUUNNIITTYY__OOFF__OOWWNNEERRSS

                       +o CCOOMMMMUUNNIITTYY__PPRROOPPEERRTTYY

                       +o CCOONNSSUULLAATTEE

                       +o CCOOOOPPEERRAATTIIVVEE

                       +o DDEESSIIGGNNAATTIIOONN__OOFF__OORRIIGGIINN__SSUUPPEERRVVIISSOORRYY__CCOOUUNNCCIILL

                       +o EECCOONNOOMMIICC__IINNTTEERREESSTT__GGRROOUUPP

                       +o EEMMBBAASSSSYY

                       +o EENNTTIITTYY__MMAANNAAGGIINNGG__NNAATTUURRAALL__AARREEAASS

                       +o FFAARRMM__PPAARRTTNNEERRSSHHIIPP

                       +o FFOOUUNNDDAATTIIOONN

                       +o GGEENNEERRAALL__AANNDD__LLIIMMIITTEEDD__PPAARRTTNNEERRSSHHIIPP

                       +o GGEENNEERRAALL__PPAARRTTNNEERRSSHHIIPP

                       +o IINNDDIIVVIIDDUUAALL

                       +o LLIIMMIITTEEDD__CCOOMMPPAANNYY

                       +o LLOOCCAALL__AAUUTTHHOORRIITTYY

                       +o LLOOCCAALL__PPUUBBLLIICC__EENNTTIITTYY

                       +o MMUUTTUUAALL__IINNSSUURRAANNCCEE__CCOOMMPPAANNYY

                       +o NNAATTIIOONNAALL__PPUUBBLLIICC__EENNTTIITTYY

                       +o OORRDDEERR__OORR__RREELLIIGGIIOOUUSS__IINNSSTTIITTUUTTIIOONN

                       +o OOTTHHEERRSS ((OOnnllyy ffoorr ccoonnttaaccttss oouuttssiiddee ooff SSppaaiinn))

                       +o PPOOLLIITTIICCAALL__PPAARRTTYY

                       +o PPRROOFFEESSSSIIOONNAALL__AASSSSOOCCIIAATTIIOONN

                       +o PPUUBBLLIICC__LLAAWW__AASSSSOOCCIIAATTIIOONN

                       +o PPUUBBLLIICC__LLIIMMIITTEEDD__CCOOMMPPAANNYY

                       +o RREEGGIIOONNAALL__GGOOVVEERRNNMMEENNTT__BBOODDYY

                       +o RREEGGIIOONNAALL__PPUUBBLLIICC__EENNTTIITTYY

                       +o SSAAVVIINNGGSS__BBAANNKK

                       +o SSPPAANNIISSHH__OOFFFFIICCEE

                       +o SSPPOORRTTSS__AASSSSOOCCIIAATTIIOONN

                       +o SSPPOORRTTSS__FFEEDDEERRAATTIIOONN

                       +o SSPPOORRTTSS__LLIIMMIITTEEDD__CCOOMMPPAANNYY

                       +o TTEEMMPPOORRAARRYY__AALLLLIIAANNCCEE__OOFF__EENNTTEERRPPRRIISSEESS

                       +o TTRRAADDEE__UUNNIIOONN

                       +o WWOORRKKEERR__OOWWNNEEDD__CCOOMMPPAANNYY

                       +o WWOORRKKEERR__OOWWNNEEDD__LLIIMMIITTEEDD__CCOOMMPPAANNYY

                       .eu

                     +o EEUU__CCOOUUNNTTRRYY__OOFF__CCIITTIIZZEENNSSHHIIPP

                       .fi

                     +o BBIIRRTTHH__DDAATTEE__IINN__YYYYYYYY__MMMM__DDDD

                     +o FFII__BBUUSSIINNEESSSS__NNUUMMBBEERR

                     +o FFII__IIDD__NNUUMMBBEERR

                     +o FFII__NNAATTIIOONNAALLIITTYY   Valid values include the following:

                       +o FFIINNNNIISSHH

                       +o NNOOTT__FFIINNNNIISSHH

                     +o FFII__OORRGGAANNIIZZAATTIIOONN__TTYYPPEE   Valid values include the follow-
                       ing:

                       +o CCOOMMPPAANNYY

                       +o CCOORRPPOORRAATTIIOONN

                       +o GGOOVVEERRNNMMEENNTT

                       +o IINNSSTTIITTUUTTIIOONN

                       +o PPOOLLIITTIICCAALL__PPAARRTTYY

                       +o PPUUBBLLIICC__CCOOMMMMUUNNIITTYY

                       +o TTOOWWNNSSHHIIPP

                       .it

                     +o IITT__NNAATTIIOONNAALLIITTYY

                     +o IITT__PPIINN

                     +o IITT__RREEGGIISSTTRRAANNTT__EENNTTIITTYY__TTYYPPEE   Valid  values  include  the
                       following:

                       +o FFOORREEIIGGNNEERRSS

                       +o FFRREEEELLAANNCCEE__WWOORRKKEERRSS  (Freelance workers and profession-
                         als)

                       +o IITTAALLIIAANN__CCOOMMPPAANNIIEESS (Italian companies  and  one-person
                         companies)

                       +o NNOONN__PPRROOFFIITT__OORRGGAANNIIZZAATTIIOONNSS

                       +o OOTTHHEERR__SSUUBBJJEECCTTSS

                       +o PPUUBBLLIICC__OORRGGAANNIIZZAATTIIOONNSS

                       .ru

                     +o BBIIRRTTHH__DDAATTEE__IINN__YYYYYYYY__MMMM__DDDD

                     +o RRUU__PPAASSSSPPOORRTT__DDAATTAA

                       .se

                     +o BBIIRRTTHH__CCOOUUNNTTRRYY

                     +o SSEE__IIDD__NNUUMMBBEERR

                       .sg

                     +o SSGG__IIDD__NNUUMMBBEERR

                       .uk, .co.uk, .me.uk, and .org.uk

                     +o UUKK__CCOONNTTAACCTT__TTYYPPEE   Valid values include the following:

                       +o CCRRCC (UK Corporation by Royal Charter)

                       +o FFCCOORRPP (Non-UK Corporation)

                       +o FFIINNDD (Non-UK Individual, representing self)

                       +o FFOOTTHHEERR  (Non-UK  Entity  that  does  not fit into any
                         other category)

                       +o GGOOVV (UK Government Body)

                       +o IINNDD (UK Individual (representing self))

                       +o IIPP (UK Industrial/Provident Registered Company)

                       +o LLLLPP (UK Limited Liability Partnership)

                       +o LLTTDD (UK Limited Company)

                       +o OOTTHHEERR (UK Entity that does not  fit  into  any  other
                         category)

                       +o PPLLCC (UK Public Limited Company)

                       +o PPTTNNRR (UK Partnership)

                       +o RRCCHHAARR (UK Registered Charity)

                       +o SSCCHH (UK School)

                       +o SSTTAATT (UK Statutory Body)

                       +o SSTTRRAA (UK Sole Trader)

                     +o UUKK__CCOOMMPPAANNYY__NNUUMMBBEERR

                     In addition, many TLDs require a VVAATT__NNUUMMBBEERR .

                 Value -> (string)
                     The  value that corresponds with the name of an extra pa-
                     rameter.

       Shorthand Syntax:

          FirstName=string,LastName=string,ContactType=string,OrganizationName=string,AddressLine1=string,AddressLine2=string,City=string,State=string,CountryCode=string,ZipCode=string,PhoneNumber=string,Email=string,Fax=string,ExtraParams=[{Name=string,Value=string},{Name=string,Value=string}]

       JSON Syntax:

          {
            "FirstName": "string",
            "LastName": "string",
            "ContactType": "PERSON"|"COMPANY"|"ASSOCIATION"|"PUBLIC_BODY"|"RESELLER",
            "OrganizationName": "string",
            "AddressLine1": "string",
            "AddressLine2": "string",
            "City": "string",
            "State": "string",
            "CountryCode": "AC"|"AD"|"AE"|"AF"|"AG"|"AI"|"AL"|"AM"|"AN"|"AO"|"AQ"|"AR"|"AS"|"AT"|"AU"|"AW"|"AX"|"AZ"|"BA"|"BB"|"BD"|"BE"|"BF"|"BG"|"BH"|"BI"|"BJ"|"BL"|"BM"|"BN"|"BO"|"BQ"|"BR"|"BS"|"BT"|"BV"|"BW"|"BY"|"BZ"|"CA"|"CC"|"CD"|"CF"|"CG"|"CH"|"CI"|"CK"|"CL"|"CM"|"CN"|"CO"|"CR"|"CU"|"CV"|"CW"|"CX"|"CY"|"CZ"|"DE"|"DJ"|"DK"|"DM"|"DO"|"DZ"|"EC"|"EE"|"EG"|"EH"|"ER"|"ES"|"ET"|"FI"|"FJ"|"FK"|"FM"|"FO"|"FR"|"GA"|"GB"|"GD"|"GE"|"GF"|"GG"|"GH"|"GI"|"GL"|"GM"|"GN"|"GP"|"GQ"|"GR"|"GS"|"GT"|"GU"|"GW"|"GY"|"HK"|"HM"|"HN"|"HR"|"HT"|"HU"|"ID"|"IE"|"IL"|"IM"|"IN"|"IO"|"IQ"|"IR"|"IS"|"IT"|"JE"|"JM"|"JO"|"JP"|"KE"|"KG"|"KH"|"KI"|"KM"|"KN"|"KP"|"KR"|"KW"|"KY"|"KZ"|"LA"|"LB"|"LC"|"LI"|"LK"|"LR"|"LS"|"LT"|"LU"|"LV"|"LY"|"MA"|"MC"|"MD"|"ME"|"MF"|"MG"|"MH"|"MK"|"ML"|"MM"|"MN"|"MO"|"MP"|"MQ"|"MR"|"MS"|"MT"|"MU"|"MV"|"MW"|"MX"|"MY"|"MZ"|"NA"|"NC"|"NE"|"NF"|"NG"|"NI"|"NL"|"NO"|"NP"|"NR"|"NU"|"NZ"|"OM"|"PA"|"PE"|"PF"|"PG"|"PH"|"PK"|"PL"|"PM"|"PN"|"PR"|"PS"|"PT"|"PW"|"PY"|"QA"|"RE"|"RO"|"RS"|"RU"|"RW"|"SA"|"SB"|"SC"|"SD"|"SE"|"SG"|"SH"|"SI"|"SJ"|"SK"|"SL"|"SM"|"SN"|"SO"|"SR"|"SS"|"ST"|"SV"|"SX"|"SY"|"SZ"|"TC"|"TD"|"TF"|"TG"|"TH"|"TJ"|"TK"|"TL"|"TM"|"TN"|"TO"|"TP"|"TR"|"TT"|"TV"|"TW"|"TZ"|"UA"|"UG"|"US"|"UY"|"UZ"|"VA"|"VC"|"VE"|"VG"|"VI"|"VN"|"VU"|"WF"|"WS"|"YE"|"YT"|"ZA"|"ZM"|"ZW",
            "ZipCode": "string",
            "PhoneNumber": "string",
            "Email": "string",
            "Fax": "string",
            "ExtraParams": [
              {
                "Name": "DUNS_NUMBER"|"BRAND_NUMBER"|"BIRTH_DEPARTMENT"|"BIRTH_DATE_IN_YYYY_MM_DD"|"BIRTH_COUNTRY"|"BIRTH_CITY"|"DOCUMENT_NUMBER"|"AU_ID_NUMBER"|"AU_ID_TYPE"|"CA_LEGAL_TYPE"|"CA_BUSINESS_ENTITY_TYPE"|"CA_LEGAL_REPRESENTATIVE"|"CA_LEGAL_REPRESENTATIVE_CAPACITY"|"ES_IDENTIFICATION"|"ES_IDENTIFICATION_TYPE"|"ES_LEGAL_FORM"|"FI_BUSINESS_NUMBER"|"FI_ID_NUMBER"|"FI_NATIONALITY"|"FI_ORGANIZATION_TYPE"|"IT_NATIONALITY"|"IT_PIN"|"IT_REGISTRANT_ENTITY_TYPE"|"RU_PASSPORT_DATA"|"SE_ID_NUMBER"|"SG_ID_NUMBER"|"VAT_NUMBER"|"UK_CONTACT_TYPE"|"UK_COMPANY_NUMBER"|"EU_COUNTRY_OF_CITIZENSHIP"|"AU_PRIORITY_TOKEN",
                "Value": "string"
              }
              ...
            ]
          }

       ----pprriivvaaccyy--pprrootteecctt--aaddmmiinn--ccoonnttaacctt  |   ----nnoo--pprriivvaaccyy--pprrootteecctt--aaddmmiinn--ccoonnttaacctt
       (boolean)
          Whether  you want to conceal contact information from WHOIS queries.
          If you specify ttrruuee , WHOIS ("who is") queries return contact infor-
          mation  either  for Amazon Registrar or for our registrar associate,
          Gandi. If you specify ffaallssee , WHOIS queries return  the  information
          that you entered for the admin contact.

          NNOOTTEE::
              You  must  specify  the same privacy setting for the administra-
              tive, billing, registrant, and technical contacts.

          Default: ttrruuee

       ----pprriivvaaccyy--pprrootteecctt--rreeggiissttrraanntt--ccoonnttaacctt   |    ----nnoo--pprriivvaaccyy--pprrootteecctt--rreeggiiss--
       ttrraanntt--ccoonnttaacctt (boolean)
          Whether  you want to conceal contact information from WHOIS queries.
          If you specify ttrruuee , WHOIS ("who is") queries return contact infor-
          mation  either  for Amazon Registrar or for our registrar associate,
          Gandi. If you specify ffaallssee , WHOIS queries return  the  information
          that you entered for the registrant contact (the domain owner).

          NNOOTTEE::
              You  must  specify  the same privacy setting for the administra-
              tive, billing, registrant, and technical contacts.

          Default: ttrruuee

       ----pprriivvaaccyy--pprrootteecctt--tteecchh--ccoonnttaacctt   |    ----nnoo--pprriivvaaccyy--pprrootteecctt--tteecchh--ccoonnttaacctt
       (boolean)
          Whether  you want to conceal contact information from WHOIS queries.
          If you specify ttrruuee , WHOIS ("who is") queries return contact infor-
          mation  either  for Amazon Registrar or for our registrar associate,
          Gandi. If you specify ffaallssee , WHOIS queries return  the  information
          that you entered for the technical contact.

          NNOOTTEE::
              You  must  specify  the same privacy setting for the administra-
              tive, billing, registrant, and technical contacts.

          Default: ttrruuee

       ----bbiilllliinngg--ccoonnttaacctt (structure)
          Provides detailed contact information.  For  information  about  the
          values that you specify for each element, see _C_o_n_t_a_c_t_D_e_t_a_i_l .

          FirstName -> (string)
              First name of contact.

          LastName -> (string)
              Last name of contact.

          ContactType -> (string)
              Indicates whether the contact is a person, company, association,
              or public organization. Note the following:

              +o If you specify a value other than PPEERRSSOONN , you must also spec-
                ify a value for OOrrggaanniizzaattiioonnNNaammee .

              +o For some TLDs, the privacy protection available depends on the
                value that you specify for CCoonnttaacctt TTyyppee . For the privacy pro-
                tection settings for your TLD, see _D_o_m_a_i_n_s _t_h_a_t _Y_o_u _C_a_n _R_e_g_i_s_-
                _t_e_r _w_i_t_h _A_m_a_z_o_n _R_o_u_t_e _5_3 in  the  _A_m_a_z_o_n  _R_o_u_t_e  _5_3  _D_e_v_e_l_o_p_e_r
                _G_u_i_d_e

              +o For  .es  domains, the value of CCoonnttaaccttTTyyppee must be PPEERRSSOONN for
                all three contacts.

          OrganizationName -> (string)
              Name of the organization for contact types other than PPEERRSSOONN .

          AddressLine1 -> (string)
              First line of the contact's address.

          AddressLine2 -> (string)
              Second line of contact's address, if any.

          City -> (string)
              The city of the contact's address.

          State -> (string)
              The state or province of the contact's city.

          CountryCode -> (string)
              Code for the country of the contact's address.

          ZipCode -> (string)
              The zip or postal code of the contact's address.

          PhoneNumber -> (string)
              The phone number of the contact.

              Constraints: Phone  number  must  be  specified  in  the  format
              "+[country dialing code].[number including any area code>]". For
              example, a US phone number might appear as ""++11..11223344556677889900"" .

          Email -> (string)
              Email address of the contact.

          Fax -> (string)
              Fax number of the contact.

              Constraints: Phone  number  must  be  specified  in  the  format
              "+[country  dialing code].[number including any area code]". For
              example, a US phone number might appear as ""++11..11223344556677889900"" .

          ExtraParams -> (list)
              A list of name-value pairs for parameters  required  by  certain
              top-level domains.

              (structure)
                 ExtraParam includes the following elements.

                 Name -> (string)
                     The name of an additional parameter that is required by a
                     top-level domain. Here are the top-level domains that re-
                     quire  additional parameters and the names of the parame-
                     ters that they require:
                        .com.au and .net.au

                     +o AAUU__IIDD__NNUUMMBBEERR

                     +o AAUU__IIDD__TTYYPPEE   Valid values include the following:

                       +o AABBNN (Australian business number)

                       +o AACCNN (Australian company number)

                       +o TTMM (Trademark number)

                       .ca

                     +o BBRRAANNDD__NNUUMMBBEERR

                     +o CCAA__BBUUSSIINNEESSSS__EENNTTIITTYY__TTYYPPEE   Valid values include the fol-
                       lowing:

                       +o BBAANNKK (Bank)

                       +o CCOOMMMMEERRCCIIAALL__CCOOMMPPAANNYY (Commercial company)

                       +o CCOOMMPPAANNYY (Company)

                       +o CCOOOOPPEERRAATTIIOONN (Cooperation)

                       +o CCOOOOPPEERRAATTIIVVEE (Cooperative)

                       +o CCOOOOPPRRIIXX (Cooprix)

                       +o CCOORRPP (Corporation)

                       +o CCRREEDDIITT__UUNNIIOONN (Credit union)

                       +o FFOOMMIIAA (Federation of mutual insurance associations)

                       +o IINNCC (Incorporated)

                       +o LLTTDD (Limited)

                       +o LLTTEEEE (Limite)

                       +o LLLLCC (Limited liability corporation)

                       +o LLLLPP (Limited liability partnership)

                       +o LLTTEE (Lte.)

                       +o MMBBAA (Mutual benefit association)

                       +o MMIICC (Mutual insurance company)

                       +o NNFFPP (Not-for-profit corporation)

                       +o SSAA (S.A.)

                       +o SSAAVVIINNGGSS__CCOOMMPPAANNYY (Savings company)

                       +o SSAAVVIINNGGSS__UUNNIIOONN (Savings union)

                       +o SSAARRLL (Socit   responsabilit limite)

                       +o TTRRUUSSTT (Trust)

                       +o UULLCC (Unlimited liability corporation)

                     +o CCAA__LLEEGGAALL__TTYYPPEE   When CCoonnttaaccttTTyyppee is PPEERRSSOONN , valid val-
                       ues include the following:

                       +o AABBOO (Aboriginal Peoples indigenous to Canada)

                       +o CCCCTT (Canadian citizen)

                       +o LLGGRR (Legal Representative of a  Canadian  Citizen  or
                         Permanent Resident)

                       +o RREESS (Permanent resident of Canada)

                     When  CCoonnttaaccttTTyyppee  is  a  value other than PPEERRSSOONN , valid
                     values include the following:

                        +o AASSSS (Canadian unincorporated association)

                        +o CCCCOO (Canadian corporation)

                        +o EEDDUU (Canadian educational institution)

                        +o GGOOVV (Government or government entity in Canada)

                        +o HHOOPP (Canadian Hospital)

                        +o IINNBB (Indian Band recognized by  the  Indian  Act  of
                          Canada)

                        +o LLAAMM (Canadian Library, Archive, or Museum)

                        +o MMAAJJ (Her/His Majesty the Queen/King)

                        +o OOMMKK (Official mark registered in Canada)

                        +o PPLLTT (Canadian Political Party)

                        +o PPRRTT (Partnership Registered in Canada)

                        +o TTDDMM (Trademark registered in Canada)

                        +o TTRRDD (Canadian Trade Union)

                        +o TTRRSS (Trust established in Canada)

                        .es

                     +o EESS__IIDDEENNTTIIFFIICCAATTIIOONN    The value of EESS__IIDDEENNTTIIFFIICCAATTIIOONN de-
                       pends on the following values:

                       +o The value of EESS__LLEEGGAALL__FFOORRMM

                       +o The value of EESS__IIDDEENNTTIIFFIICCAATTIIOONN__TTYYPPEE
                        IIff ````EESS__LLEEGGAALL__FFOORRMM```` iiss aannyy vvaalluuee ootthheerr  tthhaann  ````IINNDDII--
                        VVIIDDUUAALL```` ::

                            +o Specify  1  letter + 8 numbers (CIF [Certificado
                              de Identificacin Fiscal])

                            +o Example: B12345678

                        IIff ````EESS__LLEEGGAALL__FFOORRMM```` iiss  ````IINNDDIIVVIIDDUUAALL````  ,,  tthhee  vvaalluuee
                        tthhaatt  yyoouu ssppeecciiffyy ffoorr ````EESS__IIDDEENNTTIIFFIICCAATTIIOONN```` ddeeppeennddss oonn
                        tthhee vvaalluuee ooff ````EESS__IIDDEENNTTIIFFIICCAATTIIOONN__TTYYPPEE```` ::

                            +o If EESS__IIDDEENNTTIIFFIICCAATTIIOONN__TTYYPPEE  is  DDNNII__AANNDD__NNIIFF  (for
                              Spanish contacts):

                              +o Specify  8  numbers + 1 letter (DNI [Documento
                                Nacional de Identidad], NIF [Nmero de  Identi-
                                ficacin Fiscal])

                              +o Example: 12345678M

                            +o If EESS__IIDDEENNTTIIFFIICCAATTIIOONN__TTYYPPEE is NNIIEE (for foreigners
                              with legal residence):

                              +o Specify 1 letter + 7 numbers + 1 letter (  NIE
                                [Nmero de Identidad de Extranjero])

                              +o Example: Y1234567X

                            +o If EESS__IIDDEENNTTIIFFIICCAATTIIOONN__TTYYPPEE is OOTTHHEERR (for contacts
                              outside of Spain):

                              +o Specify a  passport  number,  drivers  license
                                number, or national identity card number

                     +o EESS__IIDDEENNTTIIFFIICCAATTIIOONN__TTYYPPEE    Valid values include the fol-
                       lowing:

                       +o DDNNII__AANNDD__NNIIFF (For Spanish contacts)

                       +o NNIIEE (For foreigners with legal residence)

                       +o OOTTHHEERR (For contacts outside of Spain)

                     +o EESS__LLEEGGAALL__FFOORRMM   Valid values include the following:

                       +o AASSSSOOCCIIAATTIIOONN

                       +o CCEENNTTRRAALL__GGOOVVEERRNNMMEENNTT__BBOODDYY

                       +o CCIIVVIILL__SSOOCCIIEETTYY

                       +o CCOOMMMMUUNNIITTYY__OOFF__OOWWNNEERRSS

                       +o CCOOMMMMUUNNIITTYY__PPRROOPPEERRTTYY

                       +o CCOONNSSUULLAATTEE

                       +o CCOOOOPPEERRAATTIIVVEE

                       +o DDEESSIIGGNNAATTIIOONN__OOFF__OORRIIGGIINN__SSUUPPEERRVVIISSOORRYY__CCOOUUNNCCIILL

                       +o EECCOONNOOMMIICC__IINNTTEERREESSTT__GGRROOUUPP

                       +o EEMMBBAASSSSYY

                       +o EENNTTIITTYY__MMAANNAAGGIINNGG__NNAATTUURRAALL__AARREEAASS

                       +o FFAARRMM__PPAARRTTNNEERRSSHHIIPP

                       +o FFOOUUNNDDAATTIIOONN

                       +o GGEENNEERRAALL__AANNDD__LLIIMMIITTEEDD__PPAARRTTNNEERRSSHHIIPP

                       +o GGEENNEERRAALL__PPAARRTTNNEERRSSHHIIPP

                       +o IINNDDIIVVIIDDUUAALL

                       +o LLIIMMIITTEEDD__CCOOMMPPAANNYY

                       +o LLOOCCAALL__AAUUTTHHOORRIITTYY

                       +o LLOOCCAALL__PPUUBBLLIICC__EENNTTIITTYY

                       +o MMUUTTUUAALL__IINNSSUURRAANNCCEE__CCOOMMPPAANNYY

                       +o NNAATTIIOONNAALL__PPUUBBLLIICC__EENNTTIITTYY

                       +o OORRDDEERR__OORR__RREELLIIGGIIOOUUSS__IINNSSTTIITTUUTTIIOONN

                       +o OOTTHHEERRSS ((OOnnllyy ffoorr ccoonnttaaccttss oouuttssiiddee ooff SSppaaiinn))

                       +o PPOOLLIITTIICCAALL__PPAARRTTYY

                       +o PPRROOFFEESSSSIIOONNAALL__AASSSSOOCCIIAATTIIOONN

                       +o PPUUBBLLIICC__LLAAWW__AASSSSOOCCIIAATTIIOONN

                       +o PPUUBBLLIICC__LLIIMMIITTEEDD__CCOOMMPPAANNYY

                       +o RREEGGIIOONNAALL__GGOOVVEERRNNMMEENNTT__BBOODDYY

                       +o RREEGGIIOONNAALL__PPUUBBLLIICC__EENNTTIITTYY

                       +o SSAAVVIINNGGSS__BBAANNKK

                       +o SSPPAANNIISSHH__OOFFFFIICCEE

                       +o SSPPOORRTTSS__AASSSSOOCCIIAATTIIOONN

                       +o SSPPOORRTTSS__FFEEDDEERRAATTIIOONN

                       +o SSPPOORRTTSS__LLIIMMIITTEEDD__CCOOMMPPAANNYY

                       +o TTEEMMPPOORRAARRYY__AALLLLIIAANNCCEE__OOFF__EENNTTEERRPPRRIISSEESS

                       +o TTRRAADDEE__UUNNIIOONN

                       +o WWOORRKKEERR__OOWWNNEEDD__CCOOMMPPAANNYY

                       +o WWOORRKKEERR__OOWWNNEEDD__LLIIMMIITTEEDD__CCOOMMPPAANNYY

                       .eu

                     +o EEUU__CCOOUUNNTTRRYY__OOFF__CCIITTIIZZEENNSSHHIIPP

                       .fi

                     +o BBIIRRTTHH__DDAATTEE__IINN__YYYYYYYY__MMMM__DDDD

                     +o FFII__BBUUSSIINNEESSSS__NNUUMMBBEERR

                     +o FFII__IIDD__NNUUMMBBEERR

                     +o FFII__NNAATTIIOONNAALLIITTYY   Valid values include the following:

                       +o FFIINNNNIISSHH

                       +o NNOOTT__FFIINNNNIISSHH

                     +o FFII__OORRGGAANNIIZZAATTIIOONN__TTYYPPEE   Valid values include the follow-
                       ing:

                       +o CCOOMMPPAANNYY

                       +o CCOORRPPOORRAATTIIOONN

                       +o GGOOVVEERRNNMMEENNTT

                       +o IINNSSTTIITTUUTTIIOONN

                       +o PPOOLLIITTIICCAALL__PPAARRTTYY

                       +o PPUUBBLLIICC__CCOOMMMMUUNNIITTYY

                       +o TTOOWWNNSSHHIIPP

                       .it

                     +o IITT__NNAATTIIOONNAALLIITTYY

                     +o IITT__PPIINN

                     +o IITT__RREEGGIISSTTRRAANNTT__EENNTTIITTYY__TTYYPPEE    Valid  values  include the
                       following:

                       +o FFOORREEIIGGNNEERRSS

                       +o FFRREEEELLAANNCCEE__WWOORRKKEERRSS (Freelance workers and  profession-
                         als)

                       +o IITTAALLIIAANN__CCOOMMPPAANNIIEESS  (Italian  companies and one-person
                         companies)

                       +o NNOONN__PPRROOFFIITT__OORRGGAANNIIZZAATTIIOONNSS

                       +o OOTTHHEERR__SSUUBBJJEECCTTSS

                       +o PPUUBBLLIICC__OORRGGAANNIIZZAATTIIOONNSS

                       .ru

                     +o BBIIRRTTHH__DDAATTEE__IINN__YYYYYYYY__MMMM__DDDD

                     +o RRUU__PPAASSSSPPOORRTT__DDAATTAA

                       .se

                     +o BBIIRRTTHH__CCOOUUNNTTRRYY

                     +o SSEE__IIDD__NNUUMMBBEERR

                       .sg

                     +o SSGG__IIDD__NNUUMMBBEERR

                       .uk, .co.uk, .me.uk, and .org.uk

                     +o UUKK__CCOONNTTAACCTT__TTYYPPEE   Valid values include the following:

                       +o CCRRCC (UK Corporation by Royal Charter)

                       +o FFCCOORRPP (Non-UK Corporation)

                       +o FFIINNDD (Non-UK Individual, representing self)

                       +o FFOOTTHHEERR (Non-UK Entity that  does  not  fit  into  any
                         other category)

                       +o GGOOVV (UK Government Body)

                       +o IINNDD (UK Individual (representing self))

                       +o IIPP (UK Industrial/Provident Registered Company)

                       +o LLLLPP (UK Limited Liability Partnership)

                       +o LLTTDD (UK Limited Company)

                       +o OOTTHHEERR  (UK  Entity  that  does not fit into any other
                         category)

                       +o PPLLCC (UK Public Limited Company)

                       +o PPTTNNRR (UK Partnership)

                       +o RRCCHHAARR (UK Registered Charity)

                       +o SSCCHH (UK School)

                       +o SSTTAATT (UK Statutory Body)

                       +o SSTTRRAA (UK Sole Trader)

                     +o UUKK__CCOOMMPPAANNYY__NNUUMMBBEERR

                     In addition, many TLDs require a VVAATT__NNUUMMBBEERR .

                 Value -> (string)
                     The value that corresponds with the name of an extra  pa-
                     rameter.

       Shorthand Syntax:

          FirstName=string,LastName=string,ContactType=string,OrganizationName=string,AddressLine1=string,AddressLine2=string,City=string,State=string,CountryCode=string,ZipCode=string,PhoneNumber=string,Email=string,Fax=string,ExtraParams=[{Name=string,Value=string},{Name=string,Value=string}]

       JSON Syntax:

          {
            "FirstName": "string",
            "LastName": "string",
            "ContactType": "PERSON"|"COMPANY"|"ASSOCIATION"|"PUBLIC_BODY"|"RESELLER",
            "OrganizationName": "string",
            "AddressLine1": "string",
            "AddressLine2": "string",
            "City": "string",
            "State": "string",
            "CountryCode": "AC"|"AD"|"AE"|"AF"|"AG"|"AI"|"AL"|"AM"|"AN"|"AO"|"AQ"|"AR"|"AS"|"AT"|"AU"|"AW"|"AX"|"AZ"|"BA"|"BB"|"BD"|"BE"|"BF"|"BG"|"BH"|"BI"|"BJ"|"BL"|"BM"|"BN"|"BO"|"BQ"|"BR"|"BS"|"BT"|"BV"|"BW"|"BY"|"BZ"|"CA"|"CC"|"CD"|"CF"|"CG"|"CH"|"CI"|"CK"|"CL"|"CM"|"CN"|"CO"|"CR"|"CU"|"CV"|"CW"|"CX"|"CY"|"CZ"|"DE"|"DJ"|"DK"|"DM"|"DO"|"DZ"|"EC"|"EE"|"EG"|"EH"|"ER"|"ES"|"ET"|"FI"|"FJ"|"FK"|"FM"|"FO"|"FR"|"GA"|"GB"|"GD"|"GE"|"GF"|"GG"|"GH"|"GI"|"GL"|"GM"|"GN"|"GP"|"GQ"|"GR"|"GS"|"GT"|"GU"|"GW"|"GY"|"HK"|"HM"|"HN"|"HR"|"HT"|"HU"|"ID"|"IE"|"IL"|"IM"|"IN"|"IO"|"IQ"|"IR"|"IS"|"IT"|"JE"|"JM"|"JO"|"JP"|"KE"|"KG"|"KH"|"KI"|"KM"|"KN"|"KP"|"KR"|"KW"|"KY"|"KZ"|"LA"|"LB"|"LC"|"LI"|"LK"|"LR"|"LS"|"LT"|"LU"|"LV"|"LY"|"MA"|"MC"|"MD"|"ME"|"MF"|"MG"|"MH"|"MK"|"ML"|"MM"|"MN"|"MO"|"MP"|"MQ"|"MR"|"MS"|"MT"|"MU"|"MV"|"MW"|"MX"|"MY"|"MZ"|"NA"|"NC"|"NE"|"NF"|"NG"|"NI"|"NL"|"NO"|"NP"|"NR"|"NU"|"NZ"|"OM"|"PA"|"PE"|"PF"|"PG"|"PH"|"PK"|"PL"|"PM"|"PN"|"PR"|"PS"|"PT"|"PW"|"PY"|"QA"|"RE"|"RO"|"RS"|"RU"|"RW"|"SA"|"SB"|"SC"|"SD"|"SE"|"SG"|"SH"|"SI"|"SJ"|"SK"|"SL"|"SM"|"SN"|"SO"|"SR"|"SS"|"ST"|"SV"|"SX"|"SY"|"SZ"|"TC"|"TD"|"TF"|"TG"|"TH"|"TJ"|"TK"|"TL"|"TM"|"TN"|"TO"|"TP"|"TR"|"TT"|"TV"|"TW"|"TZ"|"UA"|"UG"|"US"|"UY"|"UZ"|"VA"|"VC"|"VE"|"VG"|"VI"|"VN"|"VU"|"WF"|"WS"|"YE"|"YT"|"ZA"|"ZM"|"ZW",
            "ZipCode": "string",
            "PhoneNumber": "string",
            "Email": "string",
            "Fax": "string",
            "ExtraParams": [
              {
                "Name": "DUNS_NUMBER"|"BRAND_NUMBER"|"BIRTH_DEPARTMENT"|"BIRTH_DATE_IN_YYYY_MM_DD"|"BIRTH_COUNTRY"|"BIRTH_CITY"|"DOCUMENT_NUMBER"|"AU_ID_NUMBER"|"AU_ID_TYPE"|"CA_LEGAL_TYPE"|"CA_BUSINESS_ENTITY_TYPE"|"CA_LEGAL_REPRESENTATIVE"|"CA_LEGAL_REPRESENTATIVE_CAPACITY"|"ES_IDENTIFICATION"|"ES_IDENTIFICATION_TYPE"|"ES_LEGAL_FORM"|"FI_BUSINESS_NUMBER"|"FI_ID_NUMBER"|"FI_NATIONALITY"|"FI_ORGANIZATION_TYPE"|"IT_NATIONALITY"|"IT_PIN"|"IT_REGISTRANT_ENTITY_TYPE"|"RU_PASSPORT_DATA"|"SE_ID_NUMBER"|"SG_ID_NUMBER"|"VAT_NUMBER"|"UK_CONTACT_TYPE"|"UK_COMPANY_NUMBER"|"EU_COUNTRY_OF_CITIZENSHIP"|"AU_PRIORITY_TOKEN",
                "Value": "string"
              }
              ...
            ]
          }

       ----pprriivvaaccyy--pprrootteecctt--bbiilllliinngg--ccoonnttaacctt  |  ----nnoo--pprriivvaaccyy--pprrootteecctt--bbiilllliinngg--ccoonn--
       ttaacctt (boolean)
          Whether you want to conceal contact information from WHOIS  queries.
          If you specify ttrruuee , WHOIS ("who is") queries return contact infor-
          mation either for Amazon Registrar or for our  registrar  associate,
          Gandi.  If  you specify ffaallssee , WHOIS queries return the information
          that you entered for the billing contact.

          NNOOTTEE::
              You must specify the same privacy setting  for  the  administra-
              tive, billing, registrant, and technical contacts.

       ----ccllii--iinnppuutt--jjssoonn  (string) Performs service operation based on the JSON
       string provided. The JSON string follows the format provided by  ----ggeenn--
       eerraattee--ccllii--sskkeelleettoonn.  If  other  arguments  are  provided on the command
       line, the CLI values will override the JSON-provided values. It is  not
       possible to pass arbitrary binary values using a JSON-provided value as
       the string will be taken literally.

       ----ggeenneerraattee--ccllii--sskkeelleettoonn (string) Prints a  JSON  skeleton  to  standard
       output without sending an API request. If provided with no value or the
       value iinnppuutt, prints a sample input JSON that can be used as an argument
       for  ----ccllii--iinnppuutt--jjssoonn.  If provided with the value oouuttppuutt, it validates
       the command inputs and returns a sample output JSON for that command.

GGLLOOBBAALL OOPPTTIIOONNSS
       ----ddeebbuugg (boolean)

       Turn on debug logging.

       ----eennddppooiinntt--uurrll (string)

       Override command's default URL with the given URL.

       ----nnoo--vveerriiffyy--ssssll (boolean)

       By default, the AWS CLI uses SSL when communicating with AWS  services.
       For each SSL connection, the AWS CLI will verify SSL certificates. This
       option overrides the default behavior of verifying SSL certificates.

       ----nnoo--ppaaggiinnaattee (boolean)

       Disable automatic pagination. If automatic pagination is disabled,  the
       AWS CLI will only make one call, for the first page of results.

       ----oouuttppuutt (string)

       The formatting style for command output.

       +o json

       +o text

       +o table

       ----qquueerryy (string)

       A JMESPath query to use in filtering the response data.

       ----pprrooffiillee (string)

       Use a specific profile from your credential file.

       ----rreeggiioonn (string)

       The region to use. Overrides config/env settings.

       ----vveerrssiioonn (string)

       Display the version of this tool.

       ----ccoolloorr (string)

       Turn on/off color output.

       +o on

       +o off

       +o auto

       ----nnoo--ssiiggnn--rreeqquueesstt (boolean)

       Do  not  sign requests. Credentials will not be loaded if this argument
       is provided.

       ----ccaa--bbuunnddllee (string)

       The CA certificate bundle to use when verifying SSL certificates. Over-
       rides config/env settings.

       ----ccllii--rreeaadd--ttiimmeeoouutt (int)

       The  maximum socket read time in seconds. If the value is set to 0, the
       socket read will be blocking and not timeout. The default value  is  60
       seconds.

       ----ccllii--ccoonnnneecctt--ttiimmeeoouutt (int)

       The  maximum  socket connect time in seconds. If the value is set to 0,
       the socket connect will be blocking and not timeout. The default  value
       is 60 seconds.

EEXXAAMMPPLLEESS
       NNOOTTEE::
          To  use  the following examples, you must have the AWS CLI installed
          and configured. See the _G_e_t_t_i_n_g _s_t_a_r_t_e_d _g_u_i_d_e in the  _A_W_S  _C_L_I  _U_s_e_r
          _G_u_i_d_e for more information.

          Unless  otherwise  stated,  all  examples  have  unix-like quotation
          rules. These examples will need to be  adapted  to  your  terminal's
          quoting rules. See _U_s_i_n_g _q_u_o_t_a_t_i_o_n _m_a_r_k_s _w_i_t_h _s_t_r_i_n_g_s in the _A_W_S _C_L_I
          _U_s_e_r _G_u_i_d_e .

       TToo rreeggiisstteerr aa ddoommaaiinn

       The following rreeggiisstteerr--ddoommaaiinn command registers  a  domain,  retrieving
       all parameter values from a JSON-formatted file.

       This  command runs only in the uuss--eeaasstt--11 Region. If your default region
       is set to uuss--eeaasstt--11, you can omit the rreeggiioonn parameter.

          aws route53domains register-domain \
              --region us-east-1 \
              --cli-input-json file://register-domain.json

       Contents of rreeggiisstteerr--ddoommaaiinn..jjssoonn:

          {
              "DomainName": "example.com",
              "DurationInYears": 1,
              "AutoRenew": true,
              "AdminContact": {
                  "FirstName": "Martha",
                  "LastName": "Rivera",
                  "ContactType": "PERSON",
                  "OrganizationName": "Example",
                  "AddressLine1": "1 Main Street",
                  "City": "Anytown",
                  "State": "WA",
                  "CountryCode": "US",
                  "ZipCode": "98101",
                  "PhoneNumber": "+1.8005551212",
                  "Email": "mrivera@example.com"
              },
              "RegistrantContact": {
                  "FirstName": "Li",
                  "LastName": "Juan",
                  "ContactType": "PERSON",
                  "OrganizationName": "Example",
                  "AddressLine1": "1 Main Street",
                  "City": "Anytown",
                  "State": "WA",
                  "CountryCode": "US",
                  "ZipCode": "98101",
                  "PhoneNumber": "+1.8005551212",
                  "Email": "ljuan@example.com"
              },
              "TechContact": {
                  "FirstName": "Mateo",
                  "LastName": "Jackson",
                  "ContactType": "PERSON",
                  "OrganizationName": "Example",
                  "AddressLine1": "1 Main Street",
                  "City": "Anytown",
                  "State": "WA",
                  "CountryCode": "US",
                  "ZipCode": "98101",
                  "PhoneNumber": "+1.8005551212",
                  "Email": "mjackson@example.com"
              },
              "PrivacyProtectAdminContact": true,
              "PrivacyProtectRegistrantContact": true,
              "PrivacyProtectTechContact": true
          }

       Output:

          {
              "OperationId": "b114c44a-9330-47d1-a6e8-a0b11example"
          }

       To confirm that the operation succeeded, you can run  ggeett--ooppeerraattiioonn--ddee--
       ttaaiill. For more information, see _g_e_t_-_o_p_e_r_a_t_i_o_n_-_d_e_t_a_i_l .

       For  more information, see _R_e_g_i_s_t_e_r_i_n_g _a _N_e_w _D_o_m_a_i_n in the _A_m_a_z_o_n _R_o_u_t_e
       _5_3 _D_e_v_e_l_o_p_e_r _G_u_i_d_e.

       For information about which top-level domains (TLDs) require values for
       EExxttrraaPPaarraammss and what the valid values are, see _E_x_t_r_a_P_a_r_a_m in the _A_m_a_z_o_n
       _R_o_u_t_e _5_3 _A_P_I _R_e_f_e_r_e_n_c_e.

OOUUTTPPUUTT
       OperationId -> (string)
          Identifier for tracking the progress of the request.  To  query  the
          operation status, use _G_e_t_O_p_e_r_a_t_i_o_n_D_e_t_a_i_l .



                                                             REGISTER-DOMAIN()
